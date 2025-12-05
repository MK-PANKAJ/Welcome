import { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

// Constants
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080') + '/api';

export default function Dashboard() {
    const [activeTab, setActiveTab] = useState('generate');
    const [csvData, setCsvData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState([]);
    const [registryData, setRegistryData] = useState([]);

    // Single Gen State
    const [singleForm, setSingleForm] = useState({
        name: '', hours: '', position: '', startDate: '', endDate: '', email: ''
    });

    // Edit State
    const [editingCert, setEditingCert] = useState(null); // The cert object being edited
    const [showEditModal, setShowEditModal] = useState(false);

    // --- Registry Logic ---
    const fetchRegistry = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/admin/registry`);
            if (res.data.success) {
                setRegistryData(res.data.certificates);
            }
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to PERMANENTLY DELETE this certificate?')) return;
        try {
            await axios.delete(`${API_BASE}/admin/delete/${id}`);
            fetchRegistry(); // Refresh
        } catch (err) {
            alert('Failed to delete');
        }
    };

    const handleEditClick = (cert) => {
        setEditingCert({ ...cert });
        setShowEditModal(true);
    };

    const handleEditSave = async () => {
        if (!editingCert) return;
        try {
            await axios.put(`${API_BASE}/admin/update/${editingCert.certId}`, editingCert);
            setShowEditModal(false);
            setEditingCert(null);
            fetchRegistry();
            alert('Certificate Updated');
        } catch (err) {
            alert('Failed to update');
        }
    };

    useEffect(() => {
        if (activeTab === 'registry') {
            fetchRegistry();
        }
    }, [activeTab]);

    // --- Single Generate Logic ---
    const handleSingleChange = (e) => {
        setSingleForm({ ...singleForm, [e.target.name]: e.target.value });
    };

    const handleSingleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/admin/generate-single`, singleForm);
            if (res.data.success) {
                alert(`Certificate Generated! ID: ${res.data.certificate.certId}`);
                setSingleForm({ name: '', hours: '', position: '', startDate: '', endDate: '', email: '' }); // Reset
            }
        } catch (err) {
            alert('Error generating certificate');
        }
        setLoading(false);
    };

    // --- Bulk Upload Logic ---
    const onDrop = (acceptedFiles) => {
        const file = acceptedFiles[0];
        const reader = new FileReader();
        reader.onload = () => {
            const text = reader.result;
            const rows = text.split('\n').slice(1); // Skip header
            const parsed = rows.map(row => {
                // Parse Name, Hours, Position, StartDate, EndDate, Email
                const [name, hours, position, startDate, endDate, email] = row.split(',').map(s => s.trim());
                if (name && email) return { name, hours, position, startDate, endDate, email };
                return null; // Skip empty
            }).filter(x => x);
            setCsvData(parsed);
        };
        reader.readAsText(file);
    };

    const { getRootProps, getInputProps } = useDropzone({ onDrop, accept: { 'text/csv': ['.csv'] } });

    const handleBulkGenerate = async () => {
        setLoading(true);
        setLogs([]);
        try {
            const res = await axios.post(`${API_BASE}/admin/generate-bulk`, { students: csvData });
            setLogs(res.data.results);
            alert('Generation Complete!');
        } catch (err) {
            alert('Error connecting to server');
        }
        setLoading(false);
    };

    // --- Clear Auth ---
    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        window.location.href = '/';
    };

    return (
        <div className="min-h-screen bg-gray-50 relative">
            {/* Header */}
            <nav className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <h1 className="text-xl font-bold text-gray-800">High Furries Admin</h1>
                        </div>
                        <div className="flex items-center">
                            <button onClick={handleLogout} className="text-gray-600 hover:text-red-500">Logout</button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">

                {/* Tabs */}
                <div className="mb-6 border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8">
                        <button
                            onClick={() => setActiveTab('generate')}
                            className={`${activeTab === 'generate' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'} whitespace-nowrap py-4 px-1 border-b-2 font-medium`}
                        >
                            Bulk Generator
                        </button>
                        <button
                            onClick={() => setActiveTab('single')}
                            className={`${activeTab === 'single' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'} whitespace-nowrap py-4 px-1 border-b-2 font-medium`}
                        >
                            Single Generator
                        </button>
                        <button
                            onClick={() => setActiveTab('registry')}
                            className={`${activeTab === 'registry' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'} whitespace-nowrap py-4 px-1 border-b-2 font-medium`}
                        >
                            Registry
                        </button>
                    </nav>
                </div>

                {/* Tab Content: Bulk */}
                {activeTab === 'generate' && (
                    <div>
                        <div className="bg-white p-6 rounded shadow mb-6">
                            <h2 className="text-lg font-medium mb-4">Step 1: Upload CSV</h2>
                            <div {...getRootProps()} className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-500">
                                <input {...getInputProps()} />
                                <p className="text-gray-600">Drag & drop a CSV here, or click to select one</p>
                                <p className="text-sm text-gray-400 mt-2">Format: Name, Hours, Position, StartDate, EndDate, Email</p>
                            </div>

                            {csvData.length > 0 && (
                                <div className="mt-4">
                                    <p className="font-semibold text-green-600">{csvData.length} records found.</p>
                                    <button
                                        onClick={handleBulkGenerate}
                                        disabled={loading}
                                        className={`mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 ${loading ? 'opacity-50' : ''}`}
                                    >
                                        {loading ? 'Generating...' : 'Start Generation'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Logs */}
                        {logs.length > 0 && (
                            <div className="bg-white p-6 rounded shadow">
                                <h3 className="font-bold mb-4">Results</h3>
                                <div className="overflow-auto max-h-60">
                                    <table className="min-w-full">
                                        <thead>
                                            <tr className="bg-gray-50">
                                                <th className="px-4 py-2 text-left">Email</th>
                                                <th className="px-4 py-2 text-left">Status</th>
                                                <th className="px-4 py-2 text-left">Cert ID</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {logs.map((log, i) => (
                                                <tr key={i} className="border-t">
                                                    <td className="px-4 py-2">{log.email}</td>
                                                    <td className={`px-4 py-2 ${log.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                                        {log.status}
                                                    </td>
                                                    <td className="px-4 py-2">{log.certId || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Tab Content: Single */}
                {activeTab === 'single' && (
                    <div className="bg-white p-6 rounded shadow max-w-2xl mx-auto">
                        <h2 className="text-lg font-bold mb-6">Generate Single Certificate</h2>
                        <form onSubmit={handleSingleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Candidate Name</label>
                                <input name="name" type="text" required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" value={singleForm.name} onChange={handleSingleChange} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Position/Course</label>
                                    <input name="position" type="text" required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" value={singleForm.position} onChange={handleSingleChange} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Hours</label>
                                    <input name="hours" type="text" required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" value={singleForm.hours} onChange={handleSingleChange} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Start Date</label>
                                    <input name="startDate" type="text" required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" value={singleForm.startDate} onChange={handleSingleChange} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">End Date</label>
                                    <input name="endDate" type="text" required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" value={singleForm.endDate} onChange={handleSingleChange} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Email</label>
                                <input name="email" type="email" required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" value={singleForm.email} onChange={handleSingleChange} />
                            </div>

                            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50">
                                {loading ? 'Generating...' : 'Generate Certificate'}
                            </button>
                        </form>
                    </div>
                )}

                {/* Tab Content: Registry */}
                {activeTab === 'registry' && (
                    <div className="bg-white p-6 rounded shadow">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold">Issued Certificates</h2>
                            <button onClick={fetchRegistry} className="text-blue-600 hover:underline text-sm">Refresh</button>
                        </div>

                        {loading ? <p>Loading...</p> : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Candidate</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {registryData.map((cert) => (
                                            <tr key={cert._id}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{cert.certId}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cert.candidateName}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cert.position}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cert.issueDate}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                                    <button onClick={() => handleEditClick(cert)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                                                    <button onClick={() => handleDelete(cert.certId)} className="text-red-600 hover:text-red-900">Delete</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {registryData.length === 0 && <p className="text-gray-500 mt-4 text-center">No certificates found.</p>}
                            </div>
                        )}
                    </div>
                )}

            </main>

            {/* Edit Modal */}
            {showEditModal && editingCert && (
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg max-w-lg w-full p-6">
                        <h3 className="text-lg font-bold mb-4">Edit Certificate ({editingCert.certId})</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm">Name</label>
                                <input className="w-full border p-2 rounded" value={editingCert.candidateName} onChange={(e) => setEditingCert({ ...editingCert, candidateName: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm">Position</label>
                                <input className="w-full border p-2 rounded" value={editingCert.position} onChange={(e) => setEditingCert({ ...editingCert, position: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm">Hours</label>
                                <input className="w-full border p-2 rounded" value={editingCert.hours} onChange={(e) => setEditingCert({ ...editingCert, hours: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-sm">Start Date</label>
                                    <input className="w-full border p-2 rounded" value={editingCert.startDate} onChange={(e) => setEditingCert({ ...editingCert, startDate: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm">End Date</label>
                                    <input className="w-full border p-2 rounded" value={editingCert.endDate} onChange={(e) => setEditingCert({ ...editingCert, endDate: e.target.value })} />
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end space-x-3">
                            <button onClick={() => setShowEditModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                            <button onClick={handleEditSave} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save Changes</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
