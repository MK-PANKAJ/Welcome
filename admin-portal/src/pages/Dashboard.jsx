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

    const handleRevoke = async (id) => {
        if (!window.confirm('Are you sure you want to revoke this certificate?')) return;
        try {
            await axios.post(`${API_BASE}/admin/revoke/${id}`);
            fetchRegistry(); // Refresh
        } catch (err) {
            alert('Failed to revoke');
        }
    };

    useEffect(() => {
        if (activeTab === 'registry') {
            fetchRegistry();
        }
    }, [activeTab]);

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
        <div className="min-h-screen bg-gray-50">
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
                            onClick={() => setActiveTab('registry')}
                            className={`${activeTab === 'registry' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'} whitespace-nowrap py-4 px-1 border-b-2 font-medium`}
                        >
                            Registry
                        </button>
                    </nav>
                </div>

                {/* Tab Content */}
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
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {registryData.map((cert) => (
                                            <tr key={cert._id}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{cert.certId}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cert.candidateName}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cert.position}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cert.issueDate}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${cert.valid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                        {cert.valid ? 'Active' : 'Revoked'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                    {cert.valid && (
                                                        <button
                                                            onClick={() => handleRevoke(cert.certId)}
                                                            className="text-red-600 hover:text-red-900"
                                                        >
                                                            Revoke
                                                        </button>
                                                    )}
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
        </div>
    );
}
