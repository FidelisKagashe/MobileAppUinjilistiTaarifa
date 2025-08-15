# DODOMA CTF 2025 Student Canvassing Report System

A comprehensive offline-first mobile application designed for SDA Church student canvassing program reporting.

## Features

### Core Functionality
- **Offline-First Architecture**: All data stored locally using AsyncStorage
- **Password Protection**: Secure app access with optional biometric authentication
- **Weekly Report Management**: Complete digital replacement for paper-based reporting
- **Smart Sales Tracking**: Individual book entry with automatic calculations
- **Analytics Dashboard**: Performance insights with charts and trends
- **Data Export**: Backup and sharing capabilities

### Report Fields
- Student Name (canvasser)
- Weekly Hours Worked
- Books Sold with individual pricing
- Weekly Sales Amount (TSH)
- Free Literature/Magazines Distributed
- VOP (Voice of Prophecy) activities
- Church Attendance metrics
- Ministry activities (prayers, Bible studies, baptisms)
- Visitor engagement statistics

### Security Features
- Password-protected first access
- Biometric authentication support (fingerprint/Face ID)
- Report locking system (read-only after week ends)
- Secure local data storage

## Technical Stack

- **Framework**: Expo with React Native
- **Navigation**: Expo Router with tab-based structure
- **Data Storage**: AsyncStorage for offline persistence
- **Charts**: React Native Chart Kit for analytics visualization
- **Authentication**: Expo Local Authentication for biometrics
- **Forms**: React Hook Form with Yup validation
- **UI Components**: Custom components with consistent design system
- **TypeScript**: Full type safety throughout the application

## Installation & Setup

### Prerequisites
- Node.js 18+ installed
- Expo CLI installed globally (`npm install -g @expo/cli`)
- iOS Simulator or Android Emulator (for testing)

### Development Setup

1. **Clone and Install Dependencies**:
   ```bash
   git clone [repository-url]
   cd dodoma-ctf-app
   npm install
   ```

2. **Start Development Server**:
   ```bash
   npm run dev
   ```

3. **Run on Devices**:
   - iOS: Press `i` in terminal or scan QR code with Camera app
   - Android: Press `a` in terminal or scan QR code with Expo Go app

### Production Build

1. **Build for Production**:
   ```bash
   expo build:android  # For Android APK
   expo build:ios      # For iOS IPA
   ```

2. **Alternative EAS Build** (Recommended):
   ```bash
   npm install -g eas-cli
   eas build --platform android
   eas build --platform ios
   ```

## App Structure

```
app/
├── _layout.tsx              # Root layout with authentication
├── (tabs)/                  # Main tab navigation
│   ├── _layout.tsx          # Tab bar configuration
│   ├── index.tsx            # Dashboard screen
│   ├── new-report.tsx       # New report form
│   ├── reports.tsx          # Reports history
│   ├── analytics.tsx        # Analytics dashboard
│   └── settings.tsx         # App settings
components/
├── AuthGuard.tsx            # Authentication wrapper
services/
├── DataService.ts           # Data management service
types/
└── Report.ts                # TypeScript interfaces
```

## User Guide

### First Time Setup
1. Launch the app
2. Create a secure password (minimum 4 characters)
3. Enable biometric authentication (optional)

### Creating Weekly Reports
1. Navigate to "New Report" tab
2. Fill in all required fields
3. Add individual book sales with prices
4. Save the report

### Viewing Reports
1. Go to "Reports" tab
2. Tap any report to view details
3. Lock reports when week is complete
4. Export data for backup

### Analytics
- View performance trends in "Analytics" tab
- Monitor weekly progress and goals
- Track ministry impact metrics

## Data Management

### Local Storage
- All data is stored securely on the device
- No internet connection required for operation
- Automatic data persistence and backup

### Export/Import
- Export all data as JSON format
- Manual backup and restore capabilities
- Data integrity validation

### Security
- Password protection for app access
- Biometric authentication support
- Report locking to prevent accidental edits
- Secure local storage implementation

## Customization

### Adding New Fields
1. Update `WeeklyReport` interface in `types/Report.ts`
2. Add form fields in `app/(tabs)/new-report.tsx`
3. Update validation schema
4. Modify report detail view in `reports.tsx`

### Styling Changes
- All styles are defined in component StyleSheet objects
- Color system uses consistent SDA church branding
- Responsive design with platform-specific adaptations

## Support

For technical support or feature requests, contact the development team or your program coordinator.

## License

© 2025 SDA Church - DODOMA CTF Student Canvassing Program