require('dotenv').config();
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

// 1. Setup Same Email Transporter as index.js
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

// 2. Define Mongoose Model
const CertificateSchema = new mongoose.Schema({
    certId: { type: String, required: true, unique: true },
    candidateName: String,
    email: String,
    issueDate: String,
    valid: { type: Boolean, default: true }
});
// Handle if model already exists to avoid overwrite error if run multiple times
const Certificate = mongoose.models.Certificate || mongoose.model('Certificate', CertificateSchema);

async function runVerify() {
    console.log('--- Full Flow Verification ---');

    // A. Connect DB
    console.log('1. Connecting to MongoDB...');
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('   MATCH: MongoDB Connected!');
    } catch (err) {
        console.error('   FAIL: MongoDB Connection Error:', err.message);
        return;
    }

    // B. Create Test Record
    const testEmail = process.env.SMTP_USER || 'test@example.com';
    console.log(`2. Creating Test Certificate for ${testEmail}...`);

    const certId = `TEST-${Date.now()}`;
    try {
        const newCert = await Certificate.create({
            certId,
            candidateName: 'Test User',
            email: testEmail,
            issueDate: new Date().toLocaleDateString()
        });
        console.log('   MATCH: Certificate saved to Database!');
        console.log('   DB Record ID:', newCert._id);
    } catch (err) {
        console.error('   FAIL: Database Save Error:', err.message);
        return;
    }

    // C. Send Email
    console.log('3. Sending Email...');
    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: testEmail,
            subject: 'High Furries Verification Test',
            text: `This email confirms that the backend is successfully:
            1. Connected to MongoDB
            2. Saving email addresses (ID: ${certId})
            3. Sending emails via SMTP`
        });
        console.log('   MATCH: Email Sent Successfully!');
        console.log('   Message ID:', info.messageId);
    } catch (err) {
        console.error('   FAIL: Email Send Error:', err.message);
    }

    // Cleanup
    await mongoose.connection.close();
    console.log('--- Done ---');
}

runVerify();
