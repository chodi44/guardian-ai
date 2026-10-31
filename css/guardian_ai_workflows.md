# Guardian AI — Complete System Flowcharts

These flowcharts outline the end-to-end architecture, user/guardian portals, wearable hardware, and emergency response workflows for the Guardian AI smart band. This document has been thoroughly revised to address robust system behaviors, secure access, edge cases, and offline fallbacks.

## 1. End-to-End Architecture

```mermaid
flowchart TD
    UserApp[User Flutter App] <-->|BLE| Wearable[ESP32 Wearable]
    UserApp -->|HTTPS / Firebase| Backend[Secure Backend / Firebase]
    
    Wearable -->|GPS / Sensors| Wearable
    Wearable -->|GSM SMS Fallback| EmergContact[Pre-configured Phone Number/Contact]
    Wearable -->|GPRS Data *| Backend
    
    Backend -->|Push Alerts| GuardianApp[Guardian Flutter App]
    Backend -->|Case API| ResponderWeb[Authorized Responder Web Portal]
    
    classDef note fill:#f9f,stroke:#333,stroke-width:1px;
    Note(* GPRS depends on modem/network support. SMS goes directly to contacts, not the backend.):::note
```

## 2. Starting Screen and Account Selection

```mermaid
flowchart TD
    Open[Open Guardian AI App] --> Select[Select account type]
    Select --> User[User]
    Select --> Guardian[Guardian]
    
    User --> LoginUser[Login / Signup]
    Guardian --> LoginGuard[Login / Signup]
    
    LoginUser --> DashU[User Dashboard]
    LoginGuard --> DashG[Guardian Dashboard]
    
    OpenWeb[Open Responder Web Portal] --> AuthLogin[Authorized login]
    AuthLogin --> Check[Assignment & Access Check]
    Check --> DashR[Responder Dashboard]
```

## 3. Firebase Authentication & Role-Based Access

```mermaid
flowchart TD
    Client[Client App/Web Request] --> Auth[Firebase Authentication]
    Auth --> ValidToken{Valid Token?}
    ValidToken -->|No| Reject[Reject Request]
    ValidToken -->|Yes| Roles[Check Custom Claims/Roles]
    Roles --> Allowed{Has Permission for Resource?}
    Allowed -->|No| Deny[Deny & Generate Audit Log]
    Allowed -->|Yes| Execute[Execute DB/Function Request]
```

## 4. User Signup, Profile, Unique ID

```mermaid
flowchart TD
    Start[User selects Sign Up] --> Auth[Create Auth account]
    Auth --> Verify[Verify email/phone as configured]
    Verify --> Profile[Complete profile + consent choices]
    Profile --> Backend[Backend creates user profile]
    Backend --> GenID[Generate unique Guardian ID]
    GenID --> Show[Show ID + safe sharing guidance]
    Show --> Dash[User Dashboard]
```

## 5. Guardian Signup, Link Request, User Approval

```mermaid
flowchart TD
    GLogin[Guardian login/signup] --> GDash[Guardian dashboard]
    GDash --> EnterID[Enter user's ID]
    EnterID --> ValReq[Validate + request link]
    ValReq --> Found{User account found?}
    
    Found -->|No| Invalid[Invalid ID]
    Found -->|Yes| OneTime[Generate One-Time Verification Code]
    
    OneTime --> Notify[Notify User with Code]
    Notify --> Approve{User verifies code & approves?}
    
    Approve -->|No| Reject[Reject Request]
    Approve -->|Yes| Link[Create link]
    
    Link --> Perms[Set granular permissions]
    Perms --> LinkedProf[Guardian linked profile]
    LinkedProf --> Revoke[User can revoke access anytime]
```

## 6. Guardian Unlinking and Permission Revocation

```mermaid
flowchart TD
    UserDash[User Dashboard] --> SelectGuard[Select Linked Guardian]
    SelectGuard --> Action{Action}
    Action -->|Edit Permissions| Mod[Modify location/alerts permissions]
    Action -->|Revoke Access| Unlink[Unlink Guardian]
    Mod --> Backend[Update Backend]
    Unlink --> Backend
    Backend --> Remove[Revoke DB Rules access]
    Remove --> Notify[Notify Guardian of change]
```

## 7. Wearable Pairing and Secure Setup

```mermaid
flowchart TD
    AddDev[User opens Add Device] --> BLE[Enable Bluetooth]
    BLE --> Scan[Scan ESP32]
    Scan --> Found{Found?}
    
    Found -->|No| Trouble[Troubleshoot]
    Trouble --> Scan
    
    Found -->|Yes| Ident[Verify Device Identity & Certificates]
    Ident --> Pair[Secure Pairing Protocol]
    Pair --> Bind[Securely Bind device to user account]
    Bind --> ConfSOS[Configure SOS contacts]
    ConfSOS --> Diag[Sensor/GPS diagnostics]
    
    Diag --> Ready{Ready?}
    Ready -->|No| Fix[Fix]
    Fix --> Diag
    
    Ready -->|Yes| Monitor[Monitoring]
```

## 8. Normal Monitoring & Hardware Checks

```mermaid
flowchart TD
    Start[Start device] --> ReadMax[Read MAX30102]
    ReadMax --> ReadMPU[Read MPU6050]
    ReadMPU --> GPS[Read GPS if fix]
    
    GPS --> Health{Hardware Health Check}
    Health -->|Low Battery| WarnBatt[Alert Low Battery]
    Health -->|Sensor Failure| WarnSens[Alert Sensor Failure]
    Health -->|Phone Disconnected| WarnConn[Alert Phone Disconnected]
    
    Health -->|Normal| SOS[Check SOS button]
    
    SOS --> Thresh[Check configured thresholds]
    Thresh --> Event{SOS / Confirmed event?}
    
    Event -->|No| Update[Update status / send permitted data]
    Update --> Start
    
    Event -->|Yes| Emerg[Emergency flow]
```

## 9. SOS Incident Creation, Escalation & Delivery

```mermaid
flowchart TD
    Trig[Physical SOS / confirmed trigger] --> Cue[Local vibration + visible/voice cue]
    Cue --> Dedup[Check for Duplicate SOS/Idempotency Key]
    Dedup --> CreateInc[Create incident ID; capture timestamp + GPS]
    
    CreateInc --> BLE[Try paired phone over BLE]
    
    BLE --> Phone{Phone available?}
    Phone -->|Yes| HTTPS[Phone -> secure backend]
    Phone -->|No| OfflineQ[Add to Offline Queue]
    OfflineQ --> SMS[Attempt configured GSM SMS to Contact]
    
    HTTPS --> UpdateBackend[Backend creates incident; clear cloud delivery status]
    SMS --> SMSStatus[Record SMS Delivery Status]
    
    UpdateBackend --> Notify[Notify authorized guardian + show responder case]
    Notify --> WaitAck[Wait for acknowledgement]
    
    WaitAck --> Acked{Acknowledged or Closed?}
    Acked -->|Yes| StopEsc[Stop Escalation & Update Status]
    Acked -->|No| Timer[Backend timeout occurs]
    
    Timer --> Recheck{Recheck Incident Still Open?}
    Recheck -->|Yes| Escalate[Escalate to configured contacts]
    Recheck -->|No| StopEsc
    Escalate --> WaitAck
```

## 10. Incident Cancellation and Duplicate Handling

```mermaid
flowchart TD
    NewSOS[New SOS Trigger] --> CheckDedup[Check recent timestamps & Idempotency Key]
    CheckDedup --> IsDup{Is Duplicate?}
    IsDup -->|Yes| Ignore[Ignore Trigger]
    IsDup -->|No| Process[Process Incident]
    
    Process --> Cancel[User triggers cancellation]
    Cancel --> VerifyCan[Require PIN/Confirmation to cancel]
    VerifyCan --> ValidCan{Valid?}
    ValidCan -->|Yes| UpdateCan[Update status to CANCELLED]
    ValidCan -->|No| ContinueSOS[Continue SOS]
```

## 11. Fall/Impact Detection

```mermaid
flowchart TD
    Read[Read MPU6050] --> Analyze[Analyze motion pattern]
    Analyze --> Poss{Possible fall?}
    
    Poss -->|No| Read
    Poss -->|Yes| Warn[Configurable Warning / Countdown]
    
    Warn --> CancelConf{User cancels (false positive)?}
    CancelConf -->|Yes| LogCancel[Cancel SOS & Log false positive]
    LogCancel --> Read
    
    CancelConf -->|No (Timeout)| SOS[Start SOS]
```

## 12. Optional Audio Capture

```mermaid
flowchart TD
    Auth[User-authorized emergency/session] --> Perm{Permission granted & Optional feature enabled?}
    
    Perm -->|No| NoRec[No recording]
    Perm -->|Yes| Ind[Visibly indicate recording active]
    
    Ind --> Cap[Capture time-limited audio session]
    Cap --> Stop[Stop recording automatically]
    
    Stop --> SecUp{Secure upload available?}
    SecUp -->|Yes| RestUp[Restricted upload]
    SecUp -->|No| NoExp[Do not expose insecurely]
    
    RestUp --> Ret[Retention / deletion controls]
```

## 13. GPS Location and Freshness

```mermaid
flowchart TD
    Req[Request location] --> Read[Read GPS fix]
    Read --> Valid{Valid?}
    
    Valid -->|Yes| Send[Send coordinates + time + accuracy]
    Send --> Disp[Display Live Location]
    
    Valid -->|No| Cache[Check cached last location]
    Cache --> Exist{Exists?}
    
    Exist -->|Yes| Stale[Show 'Not Live': Last-known age & accuracy]
    Exist -->|No| Unavail[Location Unavailable]
```

## 14. Device Disconnection & Reconnection

```mermaid
flowchart TD
    Monitor[Monitoring] --> Ping[BLE Ping to Phone]
    Ping --> Connect{Connected?}
    Connect -->|Yes| Normal[Normal Operation]
    Connect -->|No| Alert[Trigger Local Disconnect Alert]
    Alert --> Cache[Queue offline data]
    Cache --> Scan[Attempt Reconnection]
    Scan --> Reconn{Reconnected?}
    Reconn -->|No| Scan
    Reconn -->|Yes| Sync[Sync Offline Data to App]
```

## 15. Offline Recovery and Synchronization

```mermaid
flowchart TD
    AppOffline[App detects no internet] --> Queue[Store incidents & location locally]
    Queue --> NetRest[Internet Restored]
    NetRest --> Pull[Pull from offline queue]
    Pull --> Send[Send bulk data with offline timestamps]
    Send --> Verify[Backend verifies & resolves conflicts]
    Verify --> Ack[Ack successful sync]
    Ack --> Clear[Clear local queue]
```

## 16. Responder Web Portal (Restricted)

```mermaid
flowchart TD
    Open[Responder opens web app] --> Login[Authorized login]
    Login --> Valid{Assignment & Role valid?}
    
    Valid -->|No| Deny[Deny access + audit log]
    Valid -->|Yes| Load[Load permitted & assigned cases only]
    
    Load --> Select[Select active assigned case]
    Select --> View[View details + location age]
    View --> Ack[Acknowledge]
    Ack --> Update[Update backend + generate audit log]
    Update --> Process[Follow authorized process]
    Process --> Close[Close case + audit log]
```

## 17. Notification Retry and Delivery Status

```mermaid
flowchart TD
    SendPush[Send Push Notification to Guardian] --> WaitResp[Wait for FCM Delivery Receipt]
    WaitResp --> Deliv{Delivered?}
    Deliv -->|Yes| LogSuccess[Mark Cloud Delivery Success]
    Deliv -->|No| Retry[Retry with Exponential Backoff]
    Retry --> MaxRetry{Max retries reached?}
    MaxRetry -->|No| WaitResp
    MaxRetry -->|Yes| Fallback[Trigger Fallback SMS/Call if critical]
```

## 18. Emergency Contact Setup and Verification

```mermaid
flowchart TD
    Setup[User configures emergency contact] --> Input[Enter phone number/details]
    Input --> Verif[Send verification SMS to contact]
    Verif --> ContactResp{Contact confirms?}
    ContactResp -->|No| Unverified[Mark as unverified]
    ContactResp -->|Yes| Verified[Mark as verified & Active]
    Verified --> Sync[Sync with Wearable/Backend]
```

## 19. Admin/Device Provisioning

```mermaid
flowchart TD
    Admin[Admin/Factory Portal] --> GenCert[Generate Device Identity/Certs]
    GenCert --> Flash[Flash ESP32 Firmware & Keys]
    Flash --> Test[Run Hardware Diagnostics]
    Test --> Pass{Passed?}
    Pass -->|Yes| DB[Register MAC/Keys in Backend]
    Pass -->|No| Rework[Send to Rework]
```

## 20. End-to-End Testing and Failure Scenarios

```mermaid
flowchart TD
    TestPlan[Execute Test Plan] --> Network[Network Failures: Disable Wi-Fi/Data]
    TestPlan --> Hardware[Hardware Failures: Disconnect sensors/battery]
    TestPlan --> Logical[Logical Failures: Ignore SOS, Duplicate triggers]
    
    Network --> CheckOffline[Verify Offline Queue & SMS fallback]
    Hardware --> CheckAlerts[Verify hardware failure alerts]
    Logical --> CheckTimeout[Verify timeout escalation & deduping]
```
