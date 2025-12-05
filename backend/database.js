const Datastore = require('nedb-promises');
const path = require('path');

// Initialize database
const dbDir = process.env.PERSISTENT_STORAGE_PATH || __dirname;
const dbPath = path.join(dbDir, 'certificates.db');

// Ensure directory exists if using persistent path
const fs = require('fs');
if (process.env.PERSISTENT_STORAGE_PATH && !fs.existsSync(dbDir)) {
    console.log(`Creating persistent directory: ${dbDir}`);
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = Datastore.create({ filename: dbPath, autoload: true });

console.log('Connected to NeDB database at', dbPath);

// --- Public API mirroring previous Mongoose Model ---

const Certificate = {
    // Create new certificate
    create: async (data) => {
        try {
            console.log(`[DB] Inserting certificate for: ${data.candidateName} (${data.email})`);
            // Clone data to avoid mutation
            const doc = { ...data };
            // Ensure valid default
            if (doc.valid === undefined) doc.valid = true;

            const newDoc = await db.insert(doc);
            console.log(`[DB] Insert success. ID: ${newDoc._id}`);
            return newDoc;
        } catch (error) {
            console.error(`[DB] Insert FAILED for ${data.email}:`, error);
            throw error;
        }
    },

    // Find one by query
    findOne: async (query) => {
        return await db.findOne(query);
    },

    // Update by ID
    updateOne: async (query, updates) => {
        const numAffected = await db.update(query, { $set: updates }, { multi: false });
        return { matchedCount: numAffected };
    },

    // Delete by ID
    deleteOne: async (query) => {
        const numRemoved = await db.remove(query, { multi: false });
        return { deletedCount: numRemoved };
    },

    // List all (Admin Registry)
    find: async () => {
        return await db.find({}).sort({ issueDate: -1 }); // Simple sort
    }
};

module.exports = {
    db, // raw access if needed
    Certificate
};
