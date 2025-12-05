const mongoose = require('mongoose');

// --- MongoDB Connection ---
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`[MongoDB] Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`[MongoDB] Connection Error: ${error.message}`);
        // Do not exit, let it try to reconnect or fail gracefully
    }
};

if (process.env.MONGO_URI) {
    connectDB();
} else {
    console.warn('[MongoDB] WARN: MONGO_URI is not defined in .env');
}

// --- Schema Definition ---
const certificateSchema = new mongoose.Schema({
    certId: { type: String, required: true, unique: true },
    candidateName: { type: String, required: true },
    email: { type: String, required: true },
    position: { type: String, required: true },
    hours: { type: String, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    issueDate: { type: String, required: true },
    cloudinaryUrl: { type: String, required: true },
    valid: { type: Boolean, default: true }
}, { timestamps: true });

const CertificateModel = mongoose.model('Certificate', certificateSchema);

// --- Public API Wrapper (Maintains compatibility with previous NeDB and Mongoose code) ---
const Certificate = {
    // Create new certificate
    create: async (data) => {
        try {
            console.log(`[DB] Inserting certificate for: ${data.candidateName} (${data.email})`);
            const cert = await CertificateModel.create(data);
            console.log(`[DB] Insert success. ID: ${cert._id}`);
            return cert;
        } catch (error) {
            console.error(`[DB] Insert FAILED for ${data.email}:`, error);
            throw error;
        }
    },

    // Find one by query
    findOne: async (query) => {
        return await CertificateModel.findOne(query);
    },

    // Update by ID (Note: Using MongoDB syntax)
    updateOne: async (query, updates) => {
        // Mongoose updateOne returns { matchedCount, modifiedCount, ... }
        return await CertificateModel.updateOne(query, updates);
    },

    // Delete by ID
    deleteOne: async (query) => {
        return await CertificateModel.deleteOne(query);
    },

    // List all (Admin Registry)
    find: async () => {
        return await CertificateModel.find({}).sort({ issueDate: -1 });
    }
};

module.exports = {
    connectDB,
    Certificate
};
