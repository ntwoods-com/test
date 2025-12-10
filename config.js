/**
 * Configuration File for HRMS Application
 * Replace the placeholder values with your actual credentials
 */

const CONFIG = {
    // Google Apps Script Web App URL
    // After deploying your Apps Script, paste the web app URL here
    API_URL: 'https://script.google.com/macros/s/AKfycbwwYGeut92VPyJdKdzcUtDClQODnAOQ0KA7bjlk7hFg2aUMf__Ib041hY0dxZz98h5c/exec',
    
    // Google OAuth Client ID
    // Get this from Google Cloud Console
    GOOGLE_CLIENT_ID: '1029752642188-ku0k9krbdbsttj9br238glq8h4k5loj3.apps.googleusercontent.com',
    
    // Application Settings
    APP_NAME: 'HRMS Portal',
    COMPANY_NAME: 'N.T Woods Pvt. Ltd.',
    COMPANY_ADDRESS: 'Near Dr. Gyan Prakash, Kalai Compound, NT Woods, Gandhi Park, Aligarh (202 001)',
    
    // Default settings
    DEFAULT_INTERVIEW_TIME: '10:00 AM',
    FILE_UPLOAD_LIMIT: 50, // Maximum files per upload
    
    // Allowed file types for CV upload
    ALLOWED_CV_TYPES: ['.pdf', '.doc', '.docx'],
    
    // Session timeout (in milliseconds)
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000 // 24 hours
};
