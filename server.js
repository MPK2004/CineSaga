// server.js

// Load environment variables (Service Account details, Sheet ID, etc.)
require('dotenv').config(); 
const express = require('express');
const bodyParser = require('body-parser');
// Removed: const multer = require('multer');
// Removed: const { google } = require('googleapis');
const { GoogleSpreadsheet } = require('google-spreadsheet'); // Sheets wrapper
const { JWT } = require('google-auth-library'); // Auth module
// Removed: const { Readable } = require('stream');
const path = require('path');

const app = express();
const PORT = 3003;

// --- GOOGLE API SETUP ---

// 1. JWT Authentication
const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Handle private key from .env file
    scopes: [
        'https://www.googleapis.com/auth/spreadsheets', // Only Sheets scope needed now
    ],
});

// 2. Google Sheets Setup
const sheetDoc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);

// --- Middleware (No Multer Needed) ---
app.use(express.static(__dirname));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// --- HELPER FUNCTION: Upload to Google Drive (Removed) ---


// 1. REGISTRATION ENDPOINT (Saves to Google Sheets)
app.post('/api/register', async (req, res) => {
    const { name, usn, email, phone, event, participantId } = req.body;
    
    if (!name || !participantId) {
        return res.status(400).json({ success: false, message: 'Missing required registration data.' });
    }

    try {
        await sheetDoc.loadInfo(); 
        await sheetDoc.loadInfo({ request: { timeout: 30000 } });
        const sheet = sheetDoc.sheetsByIndex[0]; // Assuming registrations are on the first tab

        await sheet.addRow({
            name,
            usn,
            email,
            phone,
            event,
            participantId,
            registeredAt: new Date().toLocaleString()
        });

        console.log(`New Registration saved to Google Sheets: ${participantId}`);
        
        res.json({ 
            success: true, 
            message: 'Registration successful and data saved to Google Sheets.', 
            data: { name, participantId, event }
        });

    } catch (error) {
        console.error('Google Sheets Error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during Sheet registration.',
            details: error.message
        });
    }
});


// 2. SUBMISSION ENDPOINT (URL-ONLY SUBMISSION)
// NOTE: Multer is removed, so we accept data directly from req.body
app.post('/api/submit', async (req, res) => {
    const { description, participantId, eventCategory, mediaUrl } = req.body;
    
    if (!participantId || !eventCategory || !description || !mediaUrl) {
        return res.status(400).json({ success: false, message: 'Missing required data (ID, Category, Description, or URL).' });
    }
    
    try {
        // The URL is the submission link for both Photography and Reels
        const submissionLink = mediaUrl; 
        
        // --- LOG SUBMISSION METADATA TO DEDICATED SHEETS TAB ---
        
        await sheetDoc.loadInfo(); 
        // Index 1 (the second tab) should be your "Submissions" tab.
        await sheetDoc.loadInfo({ request: { timeout: 30000 } });
        const submissionSheet = sheetDoc.sheetsByIndex[1] || sheetDoc.sheetsByTitle['Submissions']; 

        if (!submissionSheet) {
             throw new Error("Submission Sheet/Tab named 'Submissions' not found in Google Sheet.");
        }
        
        await submissionSheet.addRow({
            participantId,
            eventCategory,
            description,
            submissionLink,
            submittedAt: new Date().toLocaleString()
        });
        
        console.log(`Submission metadata saved to Google Sheets for ID: ${participantId}. Link: ${submissionLink}`);


        res.json({ 
            success: true, 
            message: `Submission successful! Data saved to Google Sheets.`,
            data: { participantId, eventCategory, submissionLink }
        });

    } catch (error) {
        console.error('Submission API Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    console.log(`To register, open: http://localhost:${PORT}/register.html`);
});