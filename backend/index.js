require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const QRCode = require('qrcode');
const { createCanvas, loadImage } = require('canvas');
const cloudinary = require('cloudinary').v2;
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// --- Configuration ---
// Allow Admin Portal, Main Website, and Localhost
// Plus any extra origins defined in env (comma separated)
const envAllowed = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim().replace(/\/$/, ""))
    : [];

const allowedOrigins = [
    'https://welcome-chi-three.vercel.app',
    'https://www.highfurries.com',
    'http://localhost:3000',
    'http://localhost:5173', // Vite dev
    'https://mk-pankaj.github.io', // GitHub Pages deployment
    ...envAllowed,
    undefined // Handle non-browser tools (like Postman)
];

app.use(cors({
    origin: function (origin, callback) {
        // 1. Allow mobile apps / tools (no origin header) or local file testing (origin="null")
        if (!origin || origin === 'null') return callback(null, true);

        // 2. Strict Whitelist Check
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        } else {
            // 3. Log the failure for debugging
            console.error(`[CORS BLOCK] Origin '${origin}' is not allowed. Whitelisted:`, allowedOrigins);
            return callback(new Error('Not allowed by CORS'));
        }
    }
}));

// Cloudinary Config
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/highfurries')
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB Error:', err));

// Mongoose Model
const CertificateSchema = new mongoose.Schema({
    certId: { type: String, required: true, unique: true },
    candidateName: String,
    position: String,
    hours: String,
    startDate: String,
    endDate: String,
    email: String,
    issueDate: String, // Keep for record
    cloudinaryUrl: String,
    valid: { type: Boolean, default: true }
});
const Certificate = mongoose.model('Certificate', CertificateSchema);


// --- Email Configuration ---
// --- Email Configuration ---
// Prioritize explicit SMTP settings, fall back to Gmail shorthand if only USER/PASS present
const createTransporter = () => {
    if (process.env.SMTP_HOST) {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER || process.env.EMAIL_USER,
                pass: process.env.SMTP_PASS || process.env.EMAIL_PASS
            }
        });
    } else {
        // Legacy/Simple Gmail support
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

const sendCertEmail = async (toEmail, name, cloudinaryUrl) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: toEmail,
        subject: 'Your High Furries Certificate',
        html: `
            <h3>Congratulations, ${name}!</h3>
            <p>We are pleased to present your certificate of completion.</p>
            <p>You can view and download your certificate here:</p>
            <a href="${cloudinaryUrl}" style="padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">View Certificate</a>
            <p>Or verify it by scanning the QR code on the certificate.</p>
            <br>
            <p>Best regards,<br>High Furries Team</p>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${toEmail}`);
        return true;
    } catch (error) {
        console.error(`Error sending email to ${toEmail}:`, error);
        return false;
    }
};


// --- Routes ---

// 1. Admin Login (Stub)
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        return res.json({ success: true, token: 'admin-token-123' });
    }
    res.status(401).json({ success: false, message: 'Invalid Password' });
});

// 2. Generate Bulk (The Core Logic)
app.post('/api/admin/generate-bulk', async (req, res) => {
    // Expecting array of students: [{ name, hours, position, startDate, endDate, email }]
    const { students } = req.body;

    // Safety check
    if (!students || !Array.isArray(students)) {
        return res.status(400).json({ success: false, message: 'Invalid data format' });
    }

    const results = [];

    for (const student of students) {
        try {
            // A. Generate ID
            const certId = `HF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

            // B. Generate QR
            // Point to Main Website
            const verificationURL = `https://www.highfurries.com/verify?id=${certId}`;
            const qrDataUrl = await QRCode.toDataURL(verificationURL);

            // C. Create Certificate Image
            // Ensure template.jpg exists in current directory or handle error
            const templatePath = path.join(__dirname, 'template.jpg');
            let templateImage;
            try {
                templateImage = await loadImage(templatePath);
            } catch (e) {
                console.error("Template not found, using blank", e);
                // Fallback or error? For now error to force fix
                throw new Error("Template image not found on server");
            }

            const canvas = createCanvas(templateImage.width, templateImage.height);
            const ctx = canvas.getContext('2d');

            // Draw Template
            ctx.drawImage(templateImage, 0, 0);

            // Text Configuration
            ctx.fillStyle = '#000';
            ctx.textAlign = 'center';

            // 1. Candidate Name (Center, Big)
            ctx.font = 'bold 80px Arial';
            ctx.fillText(student.name, canvas.width / 2, canvas.height / 2 - 50);

            // Font for details
            ctx.font = '50px Arial';

            // 2. Hours 
            ctx.fillText(student.hours, canvas.width / 2 - 200, canvas.height / 2 + 100);

            // 3. Position 
            ctx.fillText(student.position, canvas.width / 2 + 400, canvas.height / 2 + 100);

            // 4. From Date
            ctx.fillText(student.startDate, canvas.width / 2 - 150, canvas.height / 2 + 250);

            // 5. To Date
            ctx.fillText(student.endDate, canvas.width / 2 + 250, canvas.height / 2 + 250);

            // ID
            ctx.font = '30px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(`ID: ${certId}`, canvas.width - 50, 60);

            // Draw QR Code
            const qrImage = await loadImage(qrDataUrl);
            ctx.drawImage(qrImage, 50, canvas.height - 250, 200, 200);

            // D. Upload to Cloudinary
            const buffer = canvas.toBuffer('image/png');
            let imageUrl = 'https://placehold.co/600x400';

            if (process.env.CLOUDINARY_CLOUD_NAME) {
                await new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        { folder: 'certificates' },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        }
                    );
                    uploadStream.end(buffer);
                }).then(r => imageUrl = r.secure_url).catch(e => console.error(e));
            }

            // E. Save to DB
            const newCert = await Certificate.create({
                certId,
                candidateName: student.name,
                position: student.position,
                hours: student.hours,
                startDate: student.startDate,
                endDate: student.endDate,
                email: student.email,
                issueDate: new Date().toLocaleDateString(),
                cloudinaryUrl: imageUrl
            });

            // F. Send Email
            await sendCertEmail(student.email, student.name, imageUrl);

            results.push({ email: student.email, status: 'success', certId });

        } catch (error) {
            console.error(error);
            results.push({ email: student.email, status: 'failed', error: error.message });
        }
    }

    res.json({ success: true, results });
});

// 3. Public Verify Endpoint
app.get('/api/public/verify/:id', async (req, res) => {
    try {
        const cert = await Certificate.findOne({ certId: req.params.id });

        if (!cert) {
            return res.status(404).json({ valid: false, message: 'Certificate not found' });
        }

        if (!cert.valid) {
            return res.json({ valid: false, message: 'Certificate has been revoked' });
        }

        res.json({
            valid: true,
            candidateName: cert.candidateName,
            position: cert.position,
            hours: cert.hours,
            issueDate: cert.issueDate,
            startDate: cert.startDate,
            endDate: cert.endDate
            // cloudinaryUrl removed for security
        });

    } catch (error) {
        res.status(500).json({ valid: false, message: 'Server error' });
    }
});

// 3.5 Public Resend Email Endpoint
app.post('/api/public/resend-email/:id', async (req, res) => {
    try {
        const cert = await Certificate.findOne({ certId: req.params.id });

        if (!cert) {
            return res.status(404).json({ success: false, message: 'Certificate not found' });
        }

        if (!cert.valid) {
            return res.json({ success: false, message: 'Certificate has been revoked' });
        }

        // Mask email for privacy in response
        const maskedEmail = cert.email.replace(/(.{2})(.*)(@.*)/, '$1***$3');

        // Send Email
        const emailSent = await sendCertEmail(cert.email, cert.candidateName, cert.cloudinaryUrl);

        if (emailSent) {
            res.json({ success: true, message: `Certificate sent to ${maskedEmail}` });
        } else {
            res.status(500).json({ success: false, message: 'Failed to send email' });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// 4. Admin Registry (List all)
app.get('/api/admin/registry', async (req, res) => {
    // In real app, verify admin-token here
    try {
        const certs = await Certificate.find().sort({ _id: -1 }); // Newest first
        res.json({ success: true, certificates: certs });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// 5. Revoke Certificate
app.post('/api/admin/revoke/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Certificate.updateOne({ certId: id }, { valid: false });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// 6. Generate Single Reference Helpers for Logic Reuse would be better but keeping it self-contained for now
app.post('/api/admin/generate-single', async (req, res) => {
    const { name, hours, position, startDate, endDate, email } = req.body;

    if (!name || !email) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    try {
        // A. Generate ID
        const certId = `HF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

        // B. Generate QR
        const verificationURL = `https://www.highfurries.com/verify?id=${certId}`;
        const qrDataUrl = await QRCode.toDataURL(verificationURL);

        // C. Create Certificate Image
        const templatePath = path.join(__dirname, 'template.jpg');
        let templateImage;
        try {
            templateImage = await loadImage(templatePath);
        } catch (e) {
            throw new Error("Template image not found on server");
        }

        const canvas = createCanvas(templateImage.width, templateImage.height);
        const ctx = canvas.getContext('2d');

        // Draw Template
        ctx.drawImage(templateImage, 0, 0);

        // Text Configuration
        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';

        // 1. Candidate Name (Center, Big)
        ctx.font = 'bold 80px Arial';
        ctx.fillText(name, canvas.width / 2, canvas.height / 2 - 50);

        // Font for details
        ctx.font = '50px Arial';

        // 2. Hours 
        ctx.fillText(hours, canvas.width / 2 - 200, canvas.height / 2 + 100);

        // 3. Position 
        ctx.fillText(position, canvas.width / 2 + 400, canvas.height / 2 + 100);

        // 4. From Date
        ctx.fillText(startDate, canvas.width / 2 - 150, canvas.height / 2 + 250);

        // 5. To Date
        ctx.fillText(endDate, canvas.width / 2 + 250, canvas.height / 2 + 250);

        // ID
        ctx.font = '30px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`ID: ${certId}`, canvas.width - 50, 60);

        // Draw QR Code
        const qrImage = await loadImage(qrDataUrl);
        ctx.drawImage(qrImage, 50, canvas.height - 250, 200, 200);

        // D. Upload to Cloudinary
        const buffer = canvas.toBuffer('image/png');
        let imageUrl = 'https://placehold.co/600x400';

        if (process.env.CLOUDINARY_CLOUD_NAME) {
            await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    { folder: 'certificates' },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
                uploadStream.end(buffer);
            }).then(r => imageUrl = r.secure_url).catch(e => console.error(e));
        }

        // E. Save to DB
        const newCert = await Certificate.create({
            certId,
            candidateName: name,
            position,
            hours,
            startDate,
            endDate,
            email,
            issueDate: new Date().toLocaleDateString(),
            cloudinaryUrl: imageUrl
        });

        // F. Send Email
        await sendCertEmail(email, name, imageUrl);

        res.json({ success: true, certificate: newCert });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 7. Update Certificate
app.put('/api/admin/update/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body; // Expecting object with fields to update

        // Exclude immutable fields if necessary, but for admin portal assume trust
        // Note: This does NOT regenerate the image. It only updates the DB record.

        const result = await Certificate.updateOne({ certId: id }, updates);

        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: 'Certificate not found' });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// 8. Delete Certificate
app.delete('/api/admin/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await Certificate.deleteOne({ certId: id });

        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: 'Certificate not found' });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
