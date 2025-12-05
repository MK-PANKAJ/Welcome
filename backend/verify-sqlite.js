require('dotenv').config();
const nodemailer = require('nodemailer');
const { Certificate, db } = require('./database');

// Wait for DB to init
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// 1. Setup Email Transporter
const createTransporter = () => {
    if (process.env.SMTP_HOST) {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER || process.env.EMAIL_USER,
                pass: process.env.SMTP_PASS || process.env.EMAIL_PASS
            }
        });
    } else {
        return nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }
};

const transporter = createTransporter();

async function runVerify() {
    console.log('--- SQLite + Email Verification ---');

    // Give SQLite a moment to init if running for first time
    await sleep(1000);

    // A. Create Test Record
    const testEmail = process.env.SMTP_USER || process.env.EMAIL_USER;
    const certId = `SQL-${Date.now()}`;

    console.log(`1. Creating Test Certificate (ID: ${certId}) for ${testEmail}...`);

    try {
        await Certificate.create({
            certId,
            candidateName: 'SQLite Test User',
            email: testEmail,
            position: 'Tester',
            hours: '10',
            startDate: '2023-01-01',
            endDate: '2023-01-02',
            issueDate: new Date().toLocaleDateString(),
            valid: true
        });
        console.log('   MATCH: Certificate saved to SQLite!');
    } catch (err) {
        console.error('   FAIL: SQLite Save Error:', err.message);
        return;
    }

    // B. Verify Retrieval
    try {
        const row = await Certificate.findOne({ certId });
        if (row && row.certId === certId) {
            console.log('   MATCH: Successfully retrieved record from SQLite!');
        } else {
            console.error('   FAIL: Record not found in SQLite!');
            return;
        }
    } catch (err) {
        console.error('   FAIL: SQLite Read Error:', err.message);
    }

    // C. Send Email
    console.log('2. Sending Email...');
    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_USER || process.env.EMAIL_USER,
            to: testEmail,
            subject: 'High Furries SQLite Migration Test',
            text: `This email confirms that the backend is successfully:
            1. Using SQLite (Record ID: ${certId})
            2. Sending emails via SMTP`
        });
        console.log('   MATCH: Email Sent Successfully!');
        console.log('   Message ID:', info.messageId);
    } catch (err) {
        console.error('   FAIL: Email Send Error:', err.message);
    }

    // Cleanup - Close DB
    db.close((err) => {
        if (err) console.error(err.message);
        else console.log('--- Done (DB Closed) ---');
    });
}

runVerify();
