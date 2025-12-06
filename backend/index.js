require('dotenv').config();
const express = require('express');
const { Resend } = require('resend');
const cors = require('cors');

const cloudinary = require('cloudinary').v2;

const fs = require('fs');
const path = require('path');

// Import SQLite Wrapper
const { Certificate } = require('./database');

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




// --- Email Configuration ---


// Initialize Resend
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

if (resend) {
    console.log('[Email] Resend API Client Initialized');
} else {
    console.warn('[Email] WARN: RESEND_API_KEY is missing');
}

const sendCertEmail = async (toEmail, name, cloudinaryUrl) => {
    const htmlContent = `
        <h3>Congratulations, ${name}!</h3>
        <p>We are pleased to present your certificate of completion.</p>
        <p>You can view and download your certificate here:</p>
        <a href="${cloudinaryUrl}" style="padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">View Certificate</a>
        <p>Or verify it by scanning the QR code on the certificate.</p>
        <br>
        <p>Best regards,<br>High Furries Team</p>
    `;

    // Use Resend (HTTP API)
    if (resend) {
        try {
            const data = await resend.emails.send({
                from: process.env.EMAIL_FROM || 'High Furries System <onboarding@resend.dev>',
                to: [toEmail],
                subject: 'Your High Furries Certificate',
                html: htmlContent
            });

            if (data.error) {
                console.error('Resend API Error:', data.error);
                return { success: false, error: data.error.message };
            }

            console.log(`[Resend] Email sent to ${toEmail}. ID: ${data.data.id}`);
            return { success: true };
        } catch (error) {
            console.error('[Resend] Exception:', error);
            return { success: false, error: error.message };
        }
    } else {
        console.error('[Email] No Resend API Keys configured.');
        return { success: false, error: 'Email service not configured' };
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

    // PureImage Setup
    const PImage = require('pureimage');

    // 1. PRE-LOAD ASSETS ONCE (Performance Optimization)
    try {
        // Load Font
        const fontPath = path.join(__dirname, 'fonts', 'OpenSans-Regular.ttf');
        const font = PImage.registerFont(fontPath, 'Open Sans');
        await new Promise(r => font.load(r));

        // Load Template Image
        const templatePath = path.join(__dirname, 'template.jpg');
        const templateStream = fs.createReadStream(templatePath);
        const templateImage = await PImage.decodeJPEGFromStream(templateStream);

        // Process sequentially to avoid memory spike, but assets are cached
        for (const student of students) {
            try {
                // A. Generate ID
                const certId = `HF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

                // B. Create Certificate Image
                // Create a new canvas for this student
                const canvas = PImage.make(templateImage.width, templateImage.height);
                const ctx = canvas.getContext('2d');

                // Draw Cached Template
                ctx.drawImage(templateImage, 0, 0);

                // --- Dynamic Layout Configuration ---
                const layout = {
                    name: { x: 510, y: 344, fontSize: 90 },
                    hours: { x: 545, y: 386, fontSize: 20 },
                    position: { x: 538, y: 403, fontSize: 40 },
                    startDate: { x: 474, y: 438, fontSize: 23 },
                    endDate: { x: 548, y: 438, fontSize: 23 },
                    certId: { x: 861, y: 50, fontSize: 35 }
                };

                // Text Configuration
                ctx.fillStyle = '#000000';
                ctx.textAlign = 'center';

                // 1. Candidate Name
                ctx.font = `${layout.name.fontSize}pt 'Open Sans'`;
                ctx.fillText(student.name, layout.name.x, layout.name.y);

                // 2. Hours 
                ctx.font = `${layout.hours.fontSize}pt 'Open Sans'`;
                ctx.fillText(student.hours, layout.hours.x, layout.hours.y);

                // 3. Position 
                ctx.font = `${layout.position.fontSize}pt 'Open Sans'`;
                ctx.fillText(student.position, layout.position.x, layout.position.y);

                // 4. From Date
                ctx.font = `${layout.startDate.fontSize}pt 'Open Sans'`;
                ctx.fillText(student.startDate, layout.startDate.x, layout.startDate.y);

                // 5. To Date
                ctx.font = `${layout.endDate.fontSize}pt 'Open Sans'`;
                ctx.fillText(student.endDate, layout.endDate.x, layout.endDate.y);

                // ID
                ctx.font = `${layout.certId.fontSize}pt 'Open Sans'`;
                ctx.textAlign = 'right';
                ctx.fillText(`${certId}`, layout.certId.x, layout.certId.y);

                // C. Upload to Cloudinary
                let imageUrl = 'https://placehold.co/600x400';

                if (process.env.CLOUDINARY_CLOUD_NAME) {
                    const { PassThrough } = require('stream');
                    const stream = new PassThrough();

                    const uploadPromise = new Promise((resolve, reject) => {
                        const uploadStream = cloudinary.uploader.upload_stream(
                            { folder: 'certificates' },
                            (error, result) => {
                                if (error) reject(error);
                                else resolve(result);
                            }
                        );
                        stream.pipe(uploadStream);
                    });

                    // Encode to stream
                    await PImage.encodePNGToStream(canvas, stream);

                    const result = await uploadPromise;
                    imageUrl = result.secure_url;
                }

                // D. Persistent & Notify (Parallelize these)
                const savePromise = Certificate.create({
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

                const emailPromise = sendCertEmail(student.email, student.name, imageUrl);

                // Wait for both
                await Promise.all([savePromise, emailPromise]);

                results.push({ email: student.email, status: 'success', certId });

            } catch (innerError) {
                console.error(`Error processing student ${student.email}:`, innerError);
                results.push({ email: student.email, status: 'failed', error: innerError.message });
            }
        }

    } catch (globalError) {
        console.error("Global generation error:", globalError);
        return res.status(500).json({ success: false, message: 'Server error during generation init' });
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
        const result = await sendCertEmail(cert.email, cert.candidateName, cert.cloudinaryUrl);

        if (result.success) {
            res.json({ success: true, message: `Certificate sent to ${maskedEmail}` });
        } else {
            // Return the specific error message for debugging
            res.status(500).json({ success: false, message: 'Failed to send email', error: result.error });
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
        const certs = await Certificate.find(); // Already sorted in database.js
        console.log(`[Registry] Found ${certs.length} certificates.`);
        res.json({ success: true, certificates: certs });
    } catch (error) {
        console.error('[Registry] Error:', error);
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
        // PureImage Setup
        const PImage = require('pureimage');
        const fontPath = path.join(__dirname, 'fonts', 'OpenSans-Regular.ttf');
        const font = PImage.registerFont(fontPath, 'Open Sans');
        await new Promise(r => font.load(r));

        // A. Generate ID
        const certId = `HF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

        // B. Generate QR
        const verificationURL = `https://www.highfurries.com/verify?id=${certId}`;
        // QR rendering skipped for pureimage stability - logic matches bulk

        // C. Create Certificate Image
        const templatePath = path.join(__dirname, 'template.jpg');

        // Decode JPEG
        const templateStream = fs.createReadStream(templatePath);
        const templateImage = await PImage.decodeJPEGFromStream(templateStream);

        const canvas = PImage.make(templateImage.width, templateImage.height);
        const ctx = canvas.getContext('2d');

        // Draw Template
        ctx.drawImage(templateImage, 0, 0);

        // --- Dynamic Layout Configuration ---
        const layout = {
            name: { x: 510, y: 344, fontSize: 90 },
            hours: { x: 545, y: 386, fontSize: 20 },
            position: { x: 538, y: 403, fontSize: 40 },
            startDate: { x: 474, y: 438, fontSize: 23 },
            endDate: { x: 548, y: 438, fontSize: 23 },
            certId: { x: 861, y: 50, fontSize: 35 }
        };

        // Text Configuration
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';

        // 1. Candidate Name
        ctx.font = `${layout.name.fontSize}pt 'Open Sans'`;
        ctx.fillText(name, layout.name.x, layout.name.y);

        // 2. Hours 
        ctx.font = `${layout.hours.fontSize}pt 'Open Sans'`;
        ctx.fillText(hours, layout.hours.x, layout.hours.y);

        // 3. Position 
        ctx.font = `${layout.position.fontSize}pt 'Open Sans'`;
        ctx.fillText(position, layout.position.x, layout.position.y);

        // 4. From Date
        ctx.font = `${layout.startDate.fontSize}pt 'Open Sans'`;
        ctx.fillText(startDate, layout.startDate.x, layout.startDate.y);

        // 5. To Date
        ctx.font = `${layout.endDate.fontSize}pt 'Open Sans'`;
        ctx.fillText(endDate, layout.endDate.x, layout.endDate.y);

        // ID
        ctx.font = `${layout.certId.fontSize}pt 'Open Sans'`;
        ctx.textAlign = 'right';
        ctx.fillText(`ID: ${certId}`, layout.certId.x, layout.certId.y);

        // D. Upload to Cloudinary
        let imageUrl = 'https://placehold.co/600x400';

        if (process.env.CLOUDINARY_CLOUD_NAME) {
            const { PassThrough } = require('stream');
            const stream = new PassThrough();

            const uploadPromise = new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    { folder: 'certificates' },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
                stream.pipe(uploadStream);
            });

            await PImage.encodePNGToStream(canvas, stream);

            const result = await uploadPromise;
            imageUrl = result.secure_url;
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
