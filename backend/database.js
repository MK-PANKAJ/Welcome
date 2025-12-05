const Datastore = require('nedb-promises');
const path = require('path');

// Initialize database
const dbPath = path.resolve(__dirname, 'certificates.db');
const db = Datastore.create({ filename: dbPath, autoload: true });

console.log('Connected to NeDB database at', dbPath);

// --- Public API mirroring previous Mongoose Model ---

const Certificate = {
    // Create new certificate
    create: async (data) => {
        // Clone data to avoid mutation
        const doc = { ...data };
        // Ensure valid default
        if (doc.valid === undefined) doc.valid = true;

        return await db.insert(doc);
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
