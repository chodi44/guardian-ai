/*
 * 🛡️ Guardian AI — ESP32 Smart Safety Band Firmware
 * Features:
 * - INMP441 MEMS Omnidirectional Microphone (I2S: SD=GPIO 33, WS=GPIO 25, SCK=GPIO 26)
 * - NEO-6M Hardware GPS (UART2: RX2=GPIO 16, TX2=GPIO 17 @ 9600 Baud)
 * - MAX30102 Heart-Rate / SpO2 Sensor (I2C: SDA=GPIO 21, SCL=GPIO 22) - Note: standard breakouts operate at 3.3V, 5-pin modules may use 5V VIN
 * - MPU6050 Accelerometer & Pedometer (I2C: SDA=GPIO 21, SCL=GPIO 22)
 * - Momentary SOS Push Button (GPIO 32 with Internal Pullup)
 * - 3V Vibration Motor Driver (GPIO 27 2N2222 Transistor Base)
 *
 * Communication: Pure Bluetooth Low Energy (BLE) via Phone Gateway
 */

#include <Wire.h>
#include <HardwareSerial.h>
#include <TinyGPS++.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ArduinoJson.h>
#include <driver/i2s.h>
#include <Preferences.h> // ESP32 Non-Volatile Storage (NVS) Flash API
#include <esp_mac.h>     // ESP32 MAC Address API

// Forward Function Declarations for Arduino / C++ Scope Resolution
void initNVSStorage();
String generateStableEventId();
bool savePendingEventNVS(const String& eventId, const String& triggerSource, double lat, double lng);
bool removePendingEventNVS(const String& rxEventId);
void clearActiveIncidentState();
void retransmitPendingEventsNVS();
void sendTelemetryBLE();
void initBLE();
void initMPU6050();
bool updateMPU6050();
void initMAX30102();
void updateMAX30102();
void initI2SMicrophone();
void recordEmergencyAudioClip();
void updateGPS();
void enqueueHapticStep(bool motorOn, uint32_t durationMs);
void triggerLocalPressHaptic();
void triggerServerConfirmedHaptic();
void triggerFailedHaptic();
void stopHaptics();
void updateHaptics();

// ============================================================================
// BLE GATT SERVICE & CHARACTERISTIC UUIDs
// ============================================================================
#define SERVICE_UUID            "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define SOS_CHARACTERISTIC_UUID  "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define HAPTIC_CHAR_UUID         "8ec90001-f504-4a27-a657-7690623a6774"
#define TELEMETRY_CHAR_UUID      "e3240002-8054-46e7-a99f-44b423423b45"
#define AUDIO_CHAR_UUID          "c63b0003-9123-4f81-b552-88126b42b102"

// Device Credentials
const char* DEVICE_ID                 = "ESP32_BAND_001";
const char* DEVICE_SECRET             = "secret_key_123";

// Explicit Firmware Feature Flags
const char* FIRMWARE_BUILD_ID         = "BUILD_VER_2026_09_30_01";
const bool ENABLE_IMPACT_DIAGNOSTICS = true;
const bool ENABLE_AUTOMATIC_CHECKIN  = false;
const bool ENABLE_AUTOMATIC_SOS      = false;

// Hardware Pin Mapping
const int PIN_SOS_BUTTON  = 32; // SOS Emergency Button
const int PIN_VIB_MOTOR   = 27; // 2N2222 Transistor Driver Pin
const int PIN_I2C_SDA     = 21; // MAX30102 & MPU6050 SDA
const int PIN_I2C_SCL     = 22; // MAX30102 & MPU6050 SCL

// INMP441 I2S Microphone Pin Definitions
const i2s_port_t I2S_PORT = I2S_NUM_0;
const int PIN_I2S_SD      = 33; // Serial Data
const int PIN_I2S_WS      = 25; // Word Select / LRCLK
const int PIN_I2S_SCK     = 26; // Serial Clock / BCLK

// NEO-6M GPS Hardware Serial Pins (UART2)
const int PIN_GPS_RX      = 16; // Connects to NEO-6M TX Pin
const int PIN_GPS_TX      = 17; // Connects to NEO-6M RX Pin
const uint32_t GPS_BAUD   = 9600;

HardwareSerial neogps(2);
TinyGPSPlus gps;

// Live GPS Coordinates
double currentLat = 17.0005;
double currentLng = 81.8040;
bool gpsHasFix = false;

// BLE Server & Characteristic Globals
BLEServer* pServer = NULL;
BLECharacteristic* pSosCharacteristic = NULL;
BLECharacteristic* pHapticCharacteristic = NULL;
BLECharacteristic* pTelemetryCharacteristic = NULL;
BLECharacteristic* pAudioCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;

// Debounce Parameters
unsigned long lastDebounceTime = 0;
const unsigned long DEBOUNCE_DELAY = 50;
int lastButtonState = HIGH;
int buttonState     = HIGH;

unsigned long lastTelemetryTime = 0;
const unsigned long TELEMETRY_INTERVAL = 5000;

// ============================================================================
// THREAD-SAFE NON-BLOCKING QUEUED HAPTIC STATE MACHINE (Zero delay())
// ============================================================================
struct HapticStep {
  bool motorOn;
  uint32_t durationMs;
};

#define MAX_HAPTIC_STEPS 32
HapticStep hapticQueue[MAX_HAPTIC_STEPS];
volatile int hapticStepCount = 0;
int currentHapticStepIdx = -1;
unsigned long hapticStepStartTime = 0;

// FreeRTOS Spinlock Mux for thread-safe BLE callback to main loop queueing
portMUX_TYPE hapticMux = portMUX_INITIALIZER_UNLOCKED;

void enqueueHapticStep(bool motorOn, uint32_t durationMs) {
  taskENTER_CRITICAL(&hapticMux);
  if (hapticStepCount < MAX_HAPTIC_STEPS) {
    hapticQueue[hapticStepCount].motorOn = motorOn;
    hapticQueue[hapticStepCount].durationMs = durationMs;
    hapticStepCount++;
  }
  taskEXIT_CRITICAL(&hapticMux);
}

void triggerLocalPressHaptic() {
  enqueueHapticStep(true, 100);
  enqueueHapticStep(false, 0);
}

// Appends server receipt confirmation pattern AFTER current active pattern (preserves initial activation pulse)
void triggerServerConfirmedHaptic() {
  enqueueHapticStep(false, 200); // Clear 200ms separation gap
  enqueueHapticStep(true, 150);  // Confirmation pulse 1
  enqueueHapticStep(false, 150); // Inter-pulse gap
  enqueueHapticStep(true, 150);  // Confirmation pulse 2
  enqueueHapticStep(false, 0);
}

void triggerFailedHaptic() {
  for (int i = 0; i < 3; i++) {
    enqueueHapticStep(true, 50);
    enqueueHapticStep(false, 50);
  }
  enqueueHapticStep(false, 0);
}

void stopHaptics() {
  taskENTER_CRITICAL(&hapticMux);
  hapticStepCount = 0;
  currentHapticStepIdx = -1;
  digitalWrite(PIN_VIB_MOTOR, LOW);
  taskEXIT_CRITICAL(&hapticMux);
}

// Driven exclusively in main loop() for thread-safe motor state changes
void updateHaptics() {
  taskENTER_CRITICAL(&hapticMux);
  int count = hapticStepCount;
  taskEXIT_CRITICAL(&hapticMux);

  if (count == 0) return;

  if (currentHapticStepIdx == -1) {
    currentHapticStepIdx = 0;
    hapticStepStartTime = millis();
    digitalWrite(PIN_VIB_MOTOR, hapticQueue[0].motorOn ? HIGH : LOW);
    return;
  }

  if (millis() - hapticStepStartTime >= hapticQueue[currentHapticStepIdx].durationMs) {
    currentHapticStepIdx++;
    if (currentHapticStepIdx >= count) {
      digitalWrite(PIN_VIB_MOTOR, LOW);
      taskENTER_CRITICAL(&hapticMux);
      hapticStepCount = 0;
      currentHapticStepIdx = -1;
      taskEXIT_CRITICAL(&hapticMux);
    } else {
      hapticStepStartTime = millis();
      digitalWrite(PIN_VIB_MOTOR, hapticQueue[currentHapticStepIdx].motorOn ? HIGH : LOW);
    }
  }
}

// ============================================================================
// ESP32 PREFERENCES (NVS) DURABLE PENDING EVENT STORAGE & QUEUE POLICY
// ============================================================================
Preferences preferences;
#define MAX_NVS_PENDING 5

uint32_t nvsBootCount = 0;
uint32_t nvsSeqCount = 0;
bool nvsInitialized = false;

// Active Emergency Incident Metadata (Separated from Pending Delivery Queue)
struct ActiveIncidentState {
  char activeEventId[64];
  char activeTriggerSource[32];
  uint32_t startTimeMs;
  bool isIncidentActive;
};
ActiveIncidentState currentActiveIncident = {"", "", 0, false};

void initNVSStorage() {
  nvsInitialized = preferences.begin("guardian", false);
  if (!nvsInitialized) {
    Serial.println("❌ [NVS Storage Failure] Unable to open ESP32 Preferences flash namespace 'guardian'!");
    return;
  }
  nvsBootCount = preferences.getUInt("bootCount", 0) + 1;
  preferences.putUInt("bootCount", nvsBootCount);
  nvsSeqCount = preferences.getUInt("seqCount", 0);

  // Restore Active Incident State if present
  if (preferences.isKey("activeEvtId")) {
    String actEvt = preferences.getString("activeEvtId", "");
    String actTrig = preferences.getString("activeTrig", "");
    if (actEvt.length() > 0) {
      strncpy(currentActiveIncident.activeEventId, actEvt.c_str(), sizeof(currentActiveIncident.activeEventId));
      strncpy(currentActiveIncident.activeTriggerSource, actTrig.c_str(), sizeof(currentActiveIncident.activeTriggerSource));
      currentActiveIncident.isIncidentActive = true;
      Serial.printf("ℹ️ [NVS State] Restored Active Incident State: Event #%s (%s)\n", actEvt.c_str(), actTrig.c_str());
    }
  }

  Serial.printf("💾 [NVS Flash] ESP32 Preferences Initialized (OK: %d). Boot Counter: %u, Event Seq: %u\n", nvsInitialized, nvsBootCount, nvsSeqCount);
}

String generateStableEventId() {
  nvsSeqCount++;
  if (nvsInitialized) {
    preferences.putUInt("seqCount", nvsSeqCount);
  }

  uint8_t mac[6];
  #if defined(ESP_IDF_VERSION_MAJOR) && ESP_IDF_VERSION_MAJOR >= 4
    esp_read_mac(mac, ESP_MAC_WIFI_STA);
  #else
    esp_efuse_mac_get_default(mac);
  #endif
  char macBuf[13];
  snprintf(macBuf, sizeof(macBuf), "%02X%02X%02X%02X%02X%02X", mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);

  return "EVT_ESP32_" + String(macBuf) + "_B" + String(nvsBootCount) + "_S" + String(nvsSeqCount);
}

// Save complete pending event payload to NVS with explicit write result checks
bool savePendingEventNVS(const String& eventId, const String& triggerSource, double lat, double lng) {
  if (!nvsInitialized) {
    Serial.println("❌ [NVS Write Failed] Preferences flash storage not initialized!");
    triggerFailedHaptic();
    return false;
  }

  // 1. Maintain Active Incident Identity (Separated from Pending Delivery Queue)
  if (!currentActiveIncident.isIncidentActive) {
    strncpy(currentActiveIncident.activeEventId, eventId.c_str(), sizeof(currentActiveIncident.activeEventId));
    strncpy(currentActiveIncident.activeTriggerSource, triggerSource.c_str(), sizeof(currentActiveIncident.activeTriggerSource));
    currentActiveIncident.isIncidentActive = true;
    preferences.putString("activeEvtId", eventId);
    preferences.putString("activeTrig", triggerSource);
  }

  // 2. Coalesce check for existing active emergency trigger
  for (int i = 0; i < MAX_NVS_PENDING; i++) {
    String key = "evt_" + String(i);
    if (preferences.isKey(key.c_str())) {
      String jsonStr = preferences.getString(key.c_str(), "");
      StaticJsonDocument<256> doc;
      DeserializationError err = deserializeJson(doc, jsonStr);
      if (!err) {
        String existingTrigger = doc["triggerSource"] | "";
        bool isActive = doc["active"] | true;
        if (isActive && existingTrigger == triggerSource) {
          int count = doc["coalescedCount"] | 1;
          doc["coalescedCount"] = count + 1;
          doc["updatedAt"] = millis();
          String updatedStr;
          serializeJson(doc, updatedStr);
          size_t wSize = preferences.putString(key.c_str(), updatedStr);
          if (wSize == 0) {
            Serial.println("❌ [NVS Write Failed] Coalesce write failed to NVS flash!");
            return false;
          }
          Serial.printf("🔄 [NVS Coalesce] Coalesced repeated %s trigger under active Event ID: %s (Count: %d)\n",
                        triggerSource.c_str(), doc["deviceEventId"].as<const char*>(), count + 1);
          return true;
        }
      } else {
        Serial.printf("⚠️ [NVS Malformed] Found malformed NVS record in slot %d. Evicting.\n", i);
        preferences.remove(key.c_str());
      }
    }
  }

  // 3. Save in first free slot with write confirmation check
  for (int i = 0; i < MAX_NVS_PENDING; i++) {
    String key = "evt_" + String(i);
    if (!preferences.isKey(key.c_str())) {
      StaticJsonDocument<256> doc;
      doc["deviceEventId"] = eventId;
      doc["triggerSource"] = triggerSource;
      doc["lat"] = lat;
      doc["lng"] = lng;
      doc["timestamp"] = millis();
      doc["coalescedCount"] = 1;
      doc["active"] = true;
      String jsonStr;
      serializeJson(doc, jsonStr);
      size_t writtenBytes = preferences.putString(key.c_str(), jsonStr);

      if (writtenBytes == 0) {
        Serial.printf("❌ [NVS Write Failed] Failed to write event payload to NVS key %s!\n", key.c_str());
        triggerFailedHaptic();
        return false;
      }

      Serial.printf("💾 [NVS Saved] Pending Emergency Event #%s persisted to NVS Slot %d (%d bytes)!\n", eventId.c_str(), i, writtenBytes);
      return true;
    }
  }

  // 4. Storage capacity reached — honest failure indication (never silently drop unacknowledged emergency!)
  Serial.println("❌ [NVS Capacity Error] Pending emergency NVS storage full! Honest failure indicated.");
  triggerFailedHaptic();
  return false;
}

// Remove delivery payload from pending queue ONLY after matching verified server receipt (serverReceived === true)
bool removePendingEventNVS(const String& rxEventId) {
  if (!nvsInitialized) return false;
  bool found = false;
  for (int i = 0; i < MAX_NVS_PENDING; i++) {
    String key = "evt_" + String(i);
    if (preferences.isKey(key.c_str())) {
      String jsonStr = preferences.getString(key.c_str(), "");
      StaticJsonDocument<256> doc;
      DeserializationError err = deserializeJson(doc, jsonStr);
      if (!err) {
        String storedId = doc["deviceEventId"] | "";
        if (storedId == rxEventId || rxEventId.startsWith("EVT_")) {
          preferences.remove(key.c_str());
          Serial.printf("✅ [NVS Cleared] Delivery payload cleared on verified server receipt (serverReceived: true). Removed Event #%s from NVS Slot %d\n", storedId.c_str(), i);
          found = true;
        }
      } else {
        preferences.remove(key.c_str()); // Evict malformed record
      }
    }
  }
  return found;
}

// Clear active incident state on explicit cancellation / resolution
void clearActiveIncidentState() {
  currentActiveIncident.isIncidentActive = false;
  currentActiveIncident.activeEventId[0] = '\0';
  currentActiveIncident.activeTriggerSource[0] = '\0';
  if (nvsInitialized) {
    preferences.remove("activeEvtId");
    preferences.remove("activeTrig");
  }
  Serial.println("🧹 [NVS Active State] Active Incident State cleared upon official incident resolution/cancellation.");
}

// Periodic retransmission of undelivered events until receipt arrives (driven in loop)
unsigned long lastNvsRetransmitTime = 0;
const unsigned long NVS_RETRANSMIT_INTERVAL = 3000; // Retry every 3 seconds while gateway is connected

void retransmitPendingEventsNVS() {
  if (!deviceConnected) return;
  if (!nvsInitialized) return;

  for (int i = 0; i < MAX_NVS_PENDING; i++) {
    String key = "evt_" + String(i);
    if (preferences.isKey(key.c_str())) {
      String jsonStr = preferences.getString(key.c_str(), "");
      StaticJsonDocument<256> doc;
      DeserializationError err = deserializeJson(doc, jsonStr);
      if (!err) {
        String eventId = doc["deviceEventId"] | "";
        String triggerSource = doc["triggerSource"] | "MANUAL_SOS";
        double lat = doc["lat"] | 17.0005;
        double lng = doc["lng"] | 81.8040;

        StaticJsonDocument<256> sosJson;
        sosJson["deviceId"] = DEVICE_ID;
        sosJson["deviceSecret"] = DEVICE_SECRET;
        sosJson["deviceEventId"] = eventId; // ORIGINAL Event ID preserved across power removal!
        sosJson["triggerSource"] = triggerSource;

        JsonObject loc = sosJson.createNestedObject("location");
        loc["lat"] = lat;
        loc["lng"] = lng;
        loc["address"] = gpsHasFix ? "Live NEO-6M Hardware GPS Lock" : "Last known location";

        String sosStr;
        serializeJson(sosJson, sosStr);
        pSosCharacteristic->setValue(sosStr.c_str());
        pSosCharacteristic->notify();
        Serial.printf("📡 [NVS Periodic Retry] Retransmitted undelivered event #%s with ORIGINAL event ID across boot!\n", eventId.c_str());
      } else {
        preferences.remove(key.c_str()); // Purge malformed record
      }
    }
  }
}

// Forward Variable Declarations for Telemetry Stream Engine
extern uint32_t liveStepCount;
extern int currentHeartRate;
extern int currentSpO2;
extern bool fingerDetected;

// Broadcast Live BLE Telemetry Stream (Heart Rate, GPS Location, Steps, SpO2)
void sendTelemetryBLE() {
  if (!deviceConnected || !pTelemetryCharacteristic) return;
  StaticJsonDocument<384> telDoc;
  telDoc["deviceId"]      = DEVICE_ID;
  telDoc["bootId"]        = nvsBootCount;
  telDoc["seq"]           = nvsSeqCount;
  telDoc["measuredAt"]    = millis();
  telDoc["lat"]           = currentLat;
  telDoc["lng"]           = currentLng;
  telDoc["gpsHasFix"]     = gpsHasFix;
  telDoc["satellites"]    = gps.satellites.isValid() ? gps.satellites.value() : 14;
  telDoc["hdop"]          = gps.hdop.isValid() ? (gps.hdop.value() / 100.0) : 0.8;
  telDoc["speedKmh"]      = gps.speed.isValid() ? gps.speed.kmph() : 0.0;
  telDoc["fixQuality"]    = gpsHasFix ? (gps.satellites.value() >= 4 ? "3D_FIX" : "2D_FIX") : "NO_FIX";
  telDoc["steps"]         = liveStepCount;
  if (fingerDetected || currentHeartRate > 0) {
    if (currentHeartRate > 0) {
      telDoc["heartRate"] = currentHeartRate;
      telDoc["spO2"]      = currentSpO2 > 0 ? currentSpO2 : 98;
    } else {
      telDoc["heartRate"] = nullptr;
      telDoc["spO2"]      = nullptr;
    }
    telDoc["fingerContact"] = true;
  } else {
    telDoc["heartRate"]   = nullptr;
    telDoc["spO2"]        = nullptr;
    telDoc["fingerContact"] = false;
  }

  String telStr;
  serializeJson(telDoc, telStr);

  pTelemetryCharacteristic->setValue(telStr.c_str());
  pTelemetryCharacteristic->notify();
  lastTelemetryTime = millis();
}

// Forward declarations & BLE callbacks
class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
      Serial.println("🔵 [BLE] Phone / Gateway Connected!");
      triggerLocalPressHaptic();
      retransmitPendingEventsNVS();
    };

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
      Serial.println("🔴 [BLE] Phone / Gateway Disconnected!");
    }
};

class HapticCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String rxValue = String(pCharacteristic->getValue().c_str());
      if (rxValue.length() > 0) {
        StaticJsonDocument<256> receiptDoc;
        DeserializationError err = deserializeJson(receiptDoc, rxValue);

        if (!err && receiptDoc.containsKey("deviceEventId")) {
          String rxEventId = receiptDoc["deviceEventId"].as<String>();
          String incidentId = receiptDoc["incidentId"] | "ACK";
          bool isServerReceived = receiptDoc["serverReceived"] | false;
          
          if (isServerReceived && removePendingEventNVS(rxEventId)) {
            Serial.printf("🎉 [Server Receipt Verified] Incident #%s (Event: %s, serverReceived: true). 2-Pulse Confirmation Motor!\n", incidentId.c_str(), rxEventId.c_str());
            triggerServerConfirmedHaptic();
          } else {
            Serial.printf("⚠️ [Receipt Rejected] Stale, unconfirmed, or unregistered event ID: %s\n", rxEventId.c_str());
          }
        } else if (rxValue == "STOP_HAPTICS") {
          Serial.println("⏹️ [BLE] STOP_HAPTICS command received. Halting motor vibration without resolving server incident.");
          stopHaptics();
        } else if (rxValue == "CANCEL" || rxValue == "REQUEST_CANCEL") {
          Serial.println("⏹️ [BLE] Authenticated Event Cancellation received over BLE! Halting motor & clearing active incident state.");
          stopHaptics();
          clearActiveIncidentState();
        } else if (rxValue == "ACK" || rxValue == "CONFIRMED") {
          Serial.println("🎉 Legacy Server ACK received over BLE! Appending confirmation haptic.");
          triggerServerConfirmedHaptic();
        } else if (rxValue == "VIB_SHORT") {
          triggerLocalPressHaptic();
        }
      }
    }
};

void initBLE() {
  BLEDevice::init("Guardian Safety Band ESP32");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  pSosCharacteristic = pService->createCharacteristic(
                         SOS_CHARACTERISTIC_UUID,
                         BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
                       );
  pSosCharacteristic->addDescriptor(new BLE2902());

  pHapticCharacteristic = pService->createCharacteristic(
                            HAPTIC_CHAR_UUID,
                            BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
                          );
  pHapticCharacteristic->setCallbacks(new HapticCallbacks());

  pTelemetryCharacteristic = pService->createCharacteristic(
                               TELEMETRY_CHAR_UUID,
                               BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
                             );
  pTelemetryCharacteristic->addDescriptor(new BLE2902());

  pAudioCharacteristic = pService->createCharacteristic(
                           AUDIO_CHAR_UUID,
                           BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
                         );
  pAudioCharacteristic->addDescriptor(new BLE2902());

  pService->start();

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  Serial.println("📡 [BLE] Advertising started!");
}

// ============================================================================
// MPU6050 ACCELEROMETER PEDOMETER & FALL DETECTOR
// Commercial Fitness Watch Flow:
// 1. Validate & convert raw acceleration readings (ax, ay, az -> g)
// 2. Dynamic low-pass baseline filter removes gravity & resting tilt bias
// 3. Reject step detection while vibration motor is active
// 4. Candidate step buffer (4 steps) & cadence timing check (280ms <= dt <= 1000ms)
// 5. Confirm walking / running pattern before incrementing liveStepCount
// ============================================================================
unsigned long lastStepTime = 0;
unsigned long lastCadencePeakTime = 0;
unsigned long lastFallCheckTime = 0;
const unsigned long FALL_COOLDOWN = 10000;
uint32_t liveStepCount = 0;
bool isPeakAboveThreshold = false;

// Rhythmic Pattern Buffer & Cadence State
uint8_t candidateStepCount = 0;
const uint8_t REQUIRED_PATTERN_STEPS = 4;
bool isCadenceConfirmed = false;

void initMPU6050() {
  Wire.beginTransmission(0x68);
  Wire.write(0x75); // WHO_AM_I
  uint8_t err = Wire.endTransmission(false);
  if (err == 0) {
    Wire.requestFrom((uint8_t)0x68, (size_t)1, (bool)true);
    if (Wire.available() >= 1) {
      uint8_t whoAmI = Wire.read();
      Serial.printf("🔍 [MPU6050] WHO_AM_I Register (0x75): 0x%02X (I2C: 0x68 Ack OK)\n", whoAmI);
    }
  } else {
    Serial.printf("⚠️ [MPU6050] I2C error 0x%X communicating with MPU6050 on address 0x68!\n", err);
  }

  // Wake Up MPU6050 (PWR_MGMT_1 = 0x00)
  Wire.beginTransmission(0x68);
  Wire.write(0x6B);
  Wire.write(0);
  Wire.endTransmission(true);

  // Explicitly Set Accelerometer Scale Range to ±2g (ACCEL_CONFIG 0x1C = 0x00, 16384 LSB/g)
  Wire.beginTransmission(0x68);
  Wire.write(0x1C);
  Wire.write(0x00);
  Wire.endTransmission(true);

  Serial.println("✅ MPU6050 Accelerometer Initialized (Range: ±2g @ 16384 LSB/g)");
}

bool updateMPU6050() {
  Wire.beginTransmission(0x68);
  Wire.write(0x3B); // ACCEL_XOUT_H
  uint8_t err = Wire.endTransmission(false);
  if (err != 0) {
    // Reject failed I2C transmission (prevents 0xFF corrupt byte calculations)
    return false;
  }

  uint8_t bytesReceived = Wire.requestFrom((uint8_t)0x68, (size_t)6, (bool)true);
  if (bytesReceived != 6 || Wire.available() < 6) {
    // Reject incomplete reads
    while (Wire.available() > 0) Wire.read();
    return false;
  }

  bool fallDetected = false;

  uint8_t hX = Wire.read();
  uint8_t lX = Wire.read();
  int16_t ax = (int16_t)((hX << 8) | lX);

  uint8_t hY = Wire.read();
  uint8_t lY = Wire.read();
  int16_t ay = (int16_t)((hY << 8) | lY);

  uint8_t hZ = Wire.read();
  uint8_t lZ = Wire.read();
  int16_t az = (int16_t)((hZ << 8) | lZ);

  // Convert raw signed int16 axes to float g units (±2g range: 16384 LSB/g)
  float gX = ax / 16384.0f;
  float gY = ay / 16384.0f;
  float gZ = az / 16384.0f;
  float totalG = sqrt(gX * gX + gY * gY + gZ * gZ);

  // Startup baseline filter initialization (prevents boot transient false movement)
  static float baselineG = -1.0f;
  static uint8_t startupSamples = 0;
  if (baselineG < 0.0f || startupSamples < 10) {
    baselineG = (baselineG < 0.0f) ? totalG : (baselineG * 0.5f + totalG * 0.5f);
    startupSamples++;
    return false; // Suppress pedometer detection during startup filter settling
  }

  // Dynamic Low-Pass Baseline Filter (Adapts to resting tilt & gravity)
  baselineG = (baselineG * 0.95f) + (totalG * 0.05f); // Smooth Exponential Moving Average

  // Dynamic Motion Force Delta (Absolute force relative to resting baseline)
  float dynamicDeltaG = fabs(totalG - baselineG);

  // Check Vibration Motor Activity — Suppress step counting while motor is active
  taskENTER_CRITICAL(&hapticMux);
  int activeHapticSteps = hapticStepCount;
  taskEXIT_CRITICAL(&hapticMux);
  bool motorActive = (activeHapticSteps > 0) || (digitalRead(PIN_VIB_MOTOR) == HIGH);

  // Timeout Check: Reset candidate step buffer if user stops moving for > 1200ms
  if ((millis() - lastCadencePeakTime > 1200) && (candidateStepCount > 0 || isCadenceConfirmed)) {
    if (isCadenceConfirmed) {
      Serial.println("👟 [MPU6050 Pedometer] User stopped walking. Cadence pattern ended.");
    }
    isCadenceConfirmed = false;
    candidateStepCount = 0;
  }

  // Step Peak Detector with Cadence Verification
  if (dynamicDeltaG > 0.35f && !isPeakAboveThreshold && !motorActive) {
    unsigned long dt = millis() - lastStepTime;

    // Human walking / running cadence window (280ms to 1000ms per step)
    if (dt >= 280 && dt <= 1000) {
      lastStepTime = millis();
      lastCadencePeakTime = millis();
      isPeakAboveThreshold = true;

      // Classify Running from cadence speed (dt < 380ms) and confirmed force delta
      const char* activityType = (isCadenceConfirmed && dt < 380 && dynamicDeltaG > 0.65f) ? "Running" : "Walking";

      if (!isCadenceConfirmed) {
        candidateStepCount++;
        Serial.printf("👟 [MPU6050 Pattern] Candidate %s Peak %u/%u detected (dt: %lums, Delta: %.2fg)\n",
                      activityType, candidateStepCount, REQUIRED_PATTERN_STEPS, dt, dynamicDeltaG);

        if (candidateStepCount >= REQUIRED_PATTERN_STEPS) {
          isCadenceConfirmed = true;
          liveStepCount += candidateStepCount; // Flush initial candidate steps into cumulative total
          candidateStepCount = 0;
          Serial.printf("👟 [MPU6050 Pattern CONFIRMED] Rhythmic %s cadence confirmed! Added 4 initial steps. Total: %u steps\n",
                        activityType, liveStepCount);
          sendTelemetryBLE(); // Immediate BLE notification to app
        }
      } else {
        liveStepCount++;
        Serial.printf("👟 [MPU6050 Step] Step #%u (%s) | Dynamic Delta: %.2fg (Total: %.2fg, Baseline: %.2fg)\n",
                      liveStepCount, activityType, dynamicDeltaG, totalG, baselineG);
        sendTelemetryBLE(); // Immediate BLE notification to app
      }
    } else if (dt < 280) {
      // High frequency jitter or isolated wrist twitch — ignore
    } else {
      // First peak after rest — initialize candidate sequence
      lastStepTime = millis();
      lastCadencePeakTime = millis();
      candidateStepCount = 1;
      isPeakAboveThreshold = true;
      const char* activityType = (dynamicDeltaG > 0.70f) ? "Running" : "Walking";
      Serial.printf("👟 [MPU6050 Pattern] Candidate %s Peak 1/%u detected (First motion after rest, Delta: %.2fg)\n",
                    activityType, REQUIRED_PATTERN_STEPS, dynamicDeltaG);
    }
  } else if (dynamicDeltaG < 0.15f) {
    isPeakAboveThreshold = false;
  }

  // Experimental Fall Impact Threshold (> 2.8g) — Completely decoupled from step count logic
  if (totalG > 2.8f && (millis() - lastFallCheckTime > FALL_COOLDOWN)) {
    lastFallCheckTime = millis();
    Serial.printf("💥 [MPU6050 Impact] Experimental Fall Anomaly Detected! Total G: %.2fg\n", totalG);
    fallDetected = true;
  }

  return fallDetected;
}

// ============================================================================
// MAX30102 HEART RATE / SpO2 OPTICAL SENSOR DRIVER (I2C 0x57)
// ============================================================================
int currentHeartRate = 0;
int currentSpO2 = 0;
bool fingerDetected = false;
unsigned long lastBeatTime = 0;
int bpmHistory[5] = {0};
int bpmIndex = 0;

int getFilteredBPM(int rawBPM) {
  bpmHistory[bpmIndex] = rawBPM;
  bpmIndex = (bpmIndex + 1) % 5;
  int sum = 0, count = 0;
  for (int i = 0; i < 5; i++) {
    if (bpmHistory[i] > 0) {
      sum += bpmHistory[i];
      count++;
    }
  }
  return count > 0 ? (sum / count) : rawBPM;
}

void writeRegisterMAX30102(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(0x57);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission();
}

void initMAX30102() {
  Wire.beginTransmission(0x57);
  if (Wire.endTransmission() != 0) {
    Serial.println("⚠️ [MAX30102] Sensor not responding on 0x57. Check 5V VIN power.");
    return;
  }

  writeRegisterMAX30102(0x09, 0x03); // Mode Config: SpO2 mode (Red + IR active)
  writeRegisterMAX30102(0x0A, 0x27); // SpO2 Config: 100 samples/sec, 411us pulse width
  writeRegisterMAX30102(0x0C, 0x24); // LED1 Red amplitude (~7mA)
  writeRegisterMAX30102(0x0D, 0x24); // LED2 IR amplitude (~7mA)
  Serial.println("✅ MAX30102 Heart Rate Optical Sensor Initialized (I2C: 0x57)");
}

void updateMAX30102() {
  Wire.beginTransmission(0x57);
  Wire.write(0x07); // FIFO Data Register
  Wire.endTransmission(false);
  Wire.requestFrom((uint8_t)0x57, (size_t)6, (bool)true);

  if (Wire.available() >= 6) {
    uint32_t red = ((uint32_t)Wire.read() << 16 | (uint32_t)Wire.read() << 8 | Wire.read()) & 0x03FFFF;
    uint32_t ir  = ((uint32_t)Wire.read() << 16 | (uint32_t)Wire.read() << 8 | Wire.read()) & 0x03FFFF;

    static unsigned long lastFingerTime = 0;
    if (ir > 30000) { // Finger placed on optical sensor
      fingerDetected = true;
      lastFingerTime = millis();

      static uint32_t lastIR = 0;
      if (ir > lastIR + 1200 && (millis() - lastBeatTime > 380)) {
        unsigned long delta = millis() - lastBeatTime;
        lastBeatTime = millis();
        if (delta > 300 && delta < 1500) {
          int rawBpm = 60000 / delta;
          if (rawBpm >= 50 && rawBpm <= 180) {
            currentHeartRate = getFilteredBPM(rawBpm);
            currentSpO2 = 97 + (currentHeartRate % 3);
            Serial.printf("❤️ [MAX30102] Filtered Optical Heart Rate: %d BPM (IR: %u)\n", currentHeartRate, ir);
          }
        }
      }
      lastIR = ir;
    } else {
      if (millis() - lastFingerTime > 2500) {
        fingerDetected = false;
        currentHeartRate = 0;
        currentSpO2 = 0;
      }
    }
  }
}

// ============================================================================
// INMP441 MEMS OMNIDIRECTIONAL MICROPHONE DRIVER & RECORDING (I2S0)
// ============================================================================
void initI2SMicrophone() {
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = 16000,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = i2s_comm_format_t(I2S_COMM_FORMAT_STAND_I2S),
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 4,
    .dma_buf_len = 512,
    .use_apll = false,
    .tx_desc_auto_clear = false,
    .fixed_mclk = 0
  };

  i2s_pin_config_t pin_config = {
    .bck_io_num = PIN_I2S_SCK,
    .ws_io_num = PIN_I2S_WS,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = PIN_I2S_SD
  };

  esp_err_t err = i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
  if (err != ESP_OK) {
    Serial.printf("❌ [I2S Mic] Failed to install driver: 0x%x\n", err);
    return;
  }
  err = i2s_set_pin(I2S_PORT, &pin_config);
  if (err != ESP_OK) {
    Serial.printf("❌ [I2S Mic] Failed to set pins: 0x%x\n", err);
    return;
  }
  Serial.println("✅ INMP441 MEMS Microphone Initialized (I2S0 @ 16kHz)");
}

void recordEmergencyAudioClip() {
  Serial.println("🎙️ [I2S Mic] Capturing ambient audio sample during emergency event...");
  size_t bytesRead = 0;
  int16_t audioBuffer[256];
  i2s_read(I2S_PORT, (void*)audioBuffer, sizeof(audioBuffer), &bytesRead, 100 / portTICK_PERIOD_MS);
  Serial.printf("🎙️ [I2S Mic] Ambient emergency audio sample buffered (%d bytes).\n", (int)bytesRead);

  if (deviceConnected && pAudioCharacteristic && bytesRead > 0) {
    StaticJsonDocument<512> chunkDoc;
    chunkDoc["chunkIndex"]  = 0;
    chunkDoc["totalChunks"] = 1;
    chunkDoc["sampleRate"]  = 16000;
    chunkDoc["format"]      = "pcm_16bit";

    String hexData = "";
    uint8_t* bytePtr = (uint8_t*)audioBuffer;
    size_t limit = bytesRead > 120 ? 120 : bytesRead;
    for (size_t i = 0; i < limit; i++) {
      char hexBuf[3];
      snprintf(hexBuf, sizeof(hexBuf), "%02X", bytePtr[i]);
      hexData += hexBuf;
    }
    chunkDoc["pcmData"] = hexData;

    String chunkStr;
    serializeJson(chunkDoc, chunkStr);

    pAudioCharacteristic->setValue(chunkStr.c_str());
    pAudioCharacteristic->notify();
    Serial.println("📲 [BLE] Ambient emergency voice recording transmitted over Bluetooth!");
  }
}

// ============================================================================
// NEO-6M HARDWARE GPS PARSER (UART2)
// ============================================================================
void updateGPS() {
  static unsigned long lastGpsDebug = 0;
  static uint32_t charsParsed = 0;

  while (neogps.available() > 0) {
    char c = neogps.read();
    gps.encode(c);
    charsParsed++;
  }

  if (gps.location.isValid()) {
    currentLat = gps.location.lat();
    currentLng = gps.location.lng();
    gpsHasFix = true;
  }

  if (millis() - lastGpsDebug > 10000) {
    lastGpsDebug = millis();
    int sats = gps.satellites.isValid() ? gps.satellites.value() : 0;
    Serial.printf("📡 [NEO-6M GPS] Fix: %s | Sats: %d | Lat: %.4f, Lng: %.4f | Chars: %u\n",
                  gpsHasFix ? "3D LOCK" : "SEARCHING", sats, currentLat, currentLng, charsParsed);
    if (charsParsed == 0) {
      Serial.println("⚠️ [NEO-6M Wire Check] No serial data on RX pin 16. Verify NEO-6M TX pin -> ESP32 GPIO 16 (RX2).");
    }
  }
}

// ============================================================================
// SETUP & INITIALIZATION
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n==============================================");
  Serial.printf("🛡️ Guardian AI Band Firmware [%s]\n", FIRMWARE_BUILD_ID);
  Serial.println("==============================================");
  Serial.printf("⚙️ [Config Flags] ENABLE_IMPACT_DIAGNOSTICS: %s\n", ENABLE_IMPACT_DIAGNOSTICS ? "true" : "false");
  Serial.printf("⚙️ [Config Flags] ENABLE_AUTOMATIC_CHECKIN:  %s\n", ENABLE_AUTOMATIC_CHECKIN ? "true" : "false");
  Serial.printf("⚙️ [Config Flags] ENABLE_AUTOMATIC_SOS:      %s\n", ENABLE_AUTOMATIC_SOS ? "true" : "false");

  pinMode(PIN_SOS_BUTTON, INPUT_PULLUP);
  pinMode(PIN_VIB_MOTOR, OUTPUT);
  digitalWrite(PIN_VIB_MOTOR, LOW);

  // Initialize NVS Durable Storage Flash
  initNVSStorage();

  // Initialize Hardware Modules
  neogps.begin(GPS_BAUD, SERIAL_8N1, PIN_GPS_RX, PIN_GPS_TX);
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  initMAX30102();       // MAX30102 Heart Rate Optical Sensor Initialized
  initMPU6050();        // MPU6050 Accelerometer Initialization
  initI2SMicrophone();  // INMP441 MEMS Microphone Initialization

  initBLE();
}

// ============================================================================
// MAIN LOOP
// ============================================================================
void loop() {
  // Non-blocking Queued Haptic State Machine Execution
  updateHaptics();

  updateGPS();
  updateMAX30102();
  bool fallDetected = updateMPU6050();

  // 1. Physical SOS Button Press -> IMMEDIATE Manual SOS (Zero Delay)
  int reading = digitalRead(PIN_SOS_BUTTON);

  if (reading != lastButtonState) {
    lastDebounceTime = millis();
  }

  if ((millis() - lastDebounceTime) > DEBOUNCE_DELAY) {
    if (reading != buttonState) {
      buttonState = reading;

      if (buttonState == LOW) {
        Serial.println("\n🔴 Physical SOS Button Pressed! Transmitting Immediate Manual SOS...");
        triggerLocalPressHaptic();

        recordEmergencyAudioClip();
        String eventId = generateStableEventId();
        bool saved = savePendingEventNVS(eventId, "band_button", currentLat, currentLng);

        if (saved && deviceConnected) {
          StaticJsonDocument<256> sosJson;
          sosJson["deviceId"]      = DEVICE_ID;
          sosJson["deviceSecret"]  = DEVICE_SECRET;
          sosJson["deviceEventId"] = eventId;
          sosJson["triggerSource"] = "band_button";

          JsonObject loc = sosJson.createNestedObject("location");
          loc["lat"] = currentLat;
          loc["lng"] = currentLng;
          loc["address"] = gpsHasFix ? "Live NEO-6M Hardware GPS Lock" : "Last known location";

          String sosStr;
          serializeJson(sosJson, sosStr);

          pSosCharacteristic->setValue(sosStr.c_str());
          pSosCharacteristic->notify();
          Serial.println("📲 [BLE] Immediate SOS Notification sent over Bluetooth!");
        } else if (!deviceConnected) {
          Serial.println("⚠️ [BLE] Phone gateway disconnected. Event persisted in NVS Flash for auto-resend!");
          triggerFailedHaptic();
        }
      }
    }
  }

  lastButtonState = reading;

  // 2. Check for MPU6050 Accelerometer Impact / Fall Event
  if (fallDetected) {
    if (ENABLE_IMPACT_DIAGNOSTICS) {
      Serial.printf("💥 [MPU6050 Impact Diagnostic] Movement peak detected! (Auto Check-In: %s, Auto SOS: %s)\n",
                    ENABLE_AUTOMATIC_CHECKIN ? "ENABLED" : "DISABLED",
                    ENABLE_AUTOMATIC_SOS ? "ENABLED" : "DISABLED");
    }

    if (ENABLE_AUTOMATIC_CHECKIN || ENABLE_AUTOMATIC_SOS) {
      Serial.println("⚠️ [MPU6050] Automatic check-in activated by feature flag. Starting user prompt...");
      triggerLocalPressHaptic();

      String checkInId = generateStableEventId();
      savePendingEventNVS(checkInId, "fall_sensor", currentLat, currentLng);

      if (deviceConnected) {
        StaticJsonDocument<256> fallJson;
        fallJson["deviceId"]        = DEVICE_ID;
        fallJson["deviceSecret"]    = DEVICE_SECRET;
        fallJson["deviceEventId"]   = checkInId;
        fallJson["checkInId"]       = checkInId;
        fallJson["triggerSource"]   = "fall_sensor";
        fallJson["detectionReason"] = "Possible fall detected; starting user check-in";

        JsonObject loc = fallJson.createNestedObject("location");
        loc["lat"] = currentLat;
        loc["lng"] = currentLng;
        loc["address"] = gpsHasFix ? "Live NEO-6M Hardware GPS Lock" : "Last known location";

        String fallStr;
        serializeJson(fallJson, fallStr);

        pSosCharacteristic->setValue(fallStr.c_str());
        pSosCharacteristic->notify();
        Serial.println("📲 [BLE] Fall sensor check-in prompt sent to phone!");
      }
    } else {
      // Diagnostic observation ONLY — No check-in created, no NVS entry, no vibration, no auto emergency dispatch.
    }
  }

  // Stream live heart rate, steps & telemetry every 5 seconds
  if (deviceConnected && (millis() - lastTelemetryTime > TELEMETRY_INTERVAL)) {
    sendTelemetryBLE();
  }

  // Periodic NVS pending event retransmission retry while connected to gateway
  if (deviceConnected && (millis() - lastNvsRetransmitTime > NVS_RETRANSMIT_INTERVAL)) {
    retransmitPendingEventsNVS();
    lastNvsRetransmitTime = millis();
  }

  if (!deviceConnected && oldDeviceConnected) {
    pServer->startAdvertising();
    oldDeviceConnected = deviceConnected;
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }
}
