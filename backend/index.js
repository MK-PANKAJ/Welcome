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
const allowedOrigins = [
    'https://admin.highfurries-certs.vercel.app',
    'https://www.highfurries.com',
    'http://localhost:3000',
    'http://localhost:5173', // Vite dev
    undefined // Handle non-browser tools (like Postman)
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.some(o => origin.startsWith(o) || o === origin)) {
            if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
                callback(null, true);
            } else {
                if (allowedOrigins.includes(origin)) return callback(null, true);
                if (process.env.NODE_ENV !== 'production') return callback(null, true);
                callback(new Error('Not allowed by CORS'));
            }
        } else {
            callback(new Error('Not allowed by CORS'));
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
            startDate: cert.startDate,
            endDate: cert.endDate,
            cloudinaryUrl: cert.cloudinaryUrl
        });

    } catch (error) {
        res.status(500).json({ valid: false, message: 'Server error' });
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

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
