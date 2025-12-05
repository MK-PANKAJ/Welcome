const nodemailer = require('nodemailer');
require('dotenv').config();

async function sendTest() {
    console.log('--- Email Debug Test ---');
    console.log('Host:', process.env.SMTP_HOST || 'Not set (using default/gmail?)');
    console.log('User:', process.env.SMTP_USER || process.env.EMAIL_USER);

    // Config from env matching index.js logic
    const transportConfig = process.env.SMTP_HOST ? {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER || process.env.EMAIL_USER,
            pass: process.env.SMTP_PASS || process.env.EMAIL_PASS
        }
    } : {
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    };

    let transporter = nodemailer.createTransport(transportConfig);

    try {
        // Send to self to verify
        const recipient = transportConfig.auth.user;
        console.log(`Attempting to send email to ${recipient}...`);

        let info = await transporter.sendMail({
            from: recipient,
            to: recipient,
            subject: "Test Email from High Furries Backend",
            text: "Success! Your email configuration is working correctly.",
            html: "<b>Success!</b> Your email configuration is working correctly.",
        });

        console.log("Email sent successfully!");
        console.log("Message ID:", info.messageId);
    } catch (error) {
        console.error('Email sending failed!');
        console.error(error);
    }
}

sendTest();
