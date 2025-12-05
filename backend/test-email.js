require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function sendTest() {
    console.log('Attempting to send email from:', process.env.EMAIL_USER);
    try {
        const info = await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER, // Send to self
            subject: 'Test Email from Debug Script',
            text: 'If you see this, email sending is working!'
        });
        console.log('Email sent successfully:', info.response);
    } catch (error) {
        console.error('Email sending failed:', error.message);
        if (error.code) console.error('Error Code:', error.code);
        if (error.command) console.error('Failed Command:', error.command);
    }
}

sendTest();
