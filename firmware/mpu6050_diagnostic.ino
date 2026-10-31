/*
 * 🔬 Guardian AI — Minimal MPU6050 Diagnostic & Calibration Sketch
 * Pinout: SDA = GPIO 21, SCL = GPIO 22, Motor = GPIO 27 (Kept LOW)
 * Purpose: Diagnostic verification of MPU6050 stationary 1.0g baseline, WHO_AM_I identity,
 *          ACCEL_CONFIG scale, and I2C transmission integrity.
 */

#include <Wire.h>

#define MPU6050_ADDR 0x68
const int PIN_VIB_MOTOR = 27;

uint32_t readErrorCount = 0;
uint32_t totalSampleCount = 0;
float lsbPerG = 16384.0f; // Default for ±2g range

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n==============================================");
  Serial.println("🔬 MPU6050 Standalone Hardware Diagnostic");
  Serial.println("==============================================");

  pinMode(PIN_VIB_MOTOR, OUTPUT);
  digitalWrite(PIN_VIB_MOTOR, LOW);

  Wire.begin(21, 22);
  Wire.setClock(100000); // 100kHz Standard I2C Mode for diagnostic stability

  // 1. Verify Sensor Identity (WHO_AM_I register 0x75)
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x75);
  uint8_t err = Wire.endTransmission(false);
  if (err != 0) {
    Serial.printf("❌ [I2C Error] MPU6050 not acknowledging on 0x68! I2C Error code: %d\n", err);
  } else {
    Wire.requestFrom((uint8_t)MPU6050_ADDR, (size_t)1, (bool)true);
    if (Wire.available() >= 1) {
      uint8_t whoAmI = Wire.read();
      Serial.printf("🔍 MPU6050 WHO_AM_I Register (0x75): 0x%02X (Expected: 0x68, 0x70, or 0x72)\n", whoAmI);
    }
  }

  // 2. Wake Up MPU6050 (PWR_MGMT_1 register 0x6B = 0x00)
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x6B);
  Wire.write(0x00);
  err = Wire.endTransmission(true);
  if (err != 0) {
    Serial.printf("❌ [Power Config Failed] Failed to write PWR_MGMT_1. Error: %d\n", err);
  }

  // 3. Set Accelerometer Range to ±2g (ACCEL_CONFIG register 0x1C = 0x00)
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x1C);
  Wire.write(0x00); // 0x00 = ±2g (16384 LSB/g)
  err = Wire.endTransmission(true);

  // 4. Read back ACCEL_CONFIG (0x1C) to verify scale
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x1C);
  Wire.endTransmission(false);
  Wire.requestFrom((uint8_t)MPU6050_ADDR, (size_t)1, (bool)true);
  if (Wire.available() >= 1) {
    uint8_t accelCfg = Wire.read();
    uint8_t afsSel = (accelCfg >> 3) & 0x03;
    switch (afsSel) {
      case 0: lsbPerG = 16384.0f; Serial.println("✅ Configured Range: ±2g (16384 LSB/g)"); break;
      case 1: lsbPerG = 8192.0f;  Serial.println("✅ Configured Range: ±4g (8192 LSB/g)"); break;
      case 2: lsbPerG = 4096.0f;  Serial.println("✅ Configured Range: ±8g (4096 LSB/g)"); break;
      case 3: lsbPerG = 2048.0f;  Serial.println("✅ Configured Range: ±16g (2048 LSB/g)"); break;
    }
  }

  Serial.println("----------------------------------------------------------------------------------");
  Serial.println("Raw (ax, ay, az)          | Converted (gX, gY, gZ) g     | Magnitude | Read Errors");
  Serial.println("----------------------------------------------------------------------------------");
}

void loop() {
  static unsigned long lastLogTime = 0;

  // Limit rate to 5 log lines per second (every 200ms)
  if (millis() - lastLogTime >= 200) {
    lastLogTime = millis();
    totalSampleCount++;

    Wire.beginTransmission(MPU6050_ADDR);
    Wire.write(0x3B); // ACCEL_XOUT_H
    uint8_t err = Wire.endTransmission(false);

    if (err != 0) {
      readErrorCount++;
      Serial.printf("❌ [I2C Tx Error] Register 0x3B write failed with error code: %d (Total Errors: %u)\n", err, readErrorCount);
      return;
    }

    uint8_t bytesReceived = Wire.requestFrom((uint8_t)MPU6050_ADDR, (size_t)6, (bool)true);
    if (bytesReceived != 6 || Wire.available() < 6) {
      readErrorCount++;
      Serial.printf("❌ [I2C Rx Error] Incomplete sample! Expected 6 bytes, got %u (Total Errors: %u)\n", bytesReceived, readErrorCount);
      // Flush any partial bytes
      while (Wire.available() > 0) Wire.read();
      return;
    }

    uint8_t hX = Wire.read();
    uint8_t lX = Wire.read();
    int16_t ax = (int16_t)((hX << 8) | lX);

    uint8_t hY = Wire.read();
    uint8_t lY = Wire.read();
    int16_t ay = (int16_t)((hY << 8) | lY);

    uint8_t hZ = Wire.read();
    uint8_t lZ = Wire.read();
    int16_t az = (int16_t)((hZ << 8) | lZ);

    float gX = ax / lsbPerG;
    float gY = ay / lsbPerG;
    float gZ = az / lsbPerG;
    float magnitude = sqrt(gX * gX + gY * gY + gZ * gZ);

    Serial.printf("RAW: [%6d, %6d, %6d] | g: [%+.2fg, %+.2fg, %+.2fg] | Mag: %.3fg | Errors: %u/%u\n",
                  ax, ay, az, gX, gY, gZ, magnitude, readErrorCount, totalSampleCount);
  }
}
