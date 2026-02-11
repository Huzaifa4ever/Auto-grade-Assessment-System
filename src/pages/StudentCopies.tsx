import React, { useEffect, useState } from 'react';
import styles from './StudentCopies.module.css';
import {
    getStudentCopies,
    deleteStudentCopySession,
    deleteStudentFromSession,
    clearAllStudentCopies,
    getStudentPdfUrl,
    StudentCopySession
} from '../services/api';

interface Props {
    onNavigate?: (page: string) => void;
}

export default function StudentCopies({ onNavigate }: Props) {
    const [sessions, setSessions] = useState<StudentCopySession[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedSession, setExpandedSession] = useState<string | null>(null);
    const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadSessions();
    }, []);

    async function loadSessions() {
        setLoading(true);
        setError(null);

        try {
            const result = await getStudentCopies();
            if (result.success && result.data) {
                setSessions(result.data);
                if (result.data.length > 0) {
                    setExpandedSession(result.data[0].sessionId);
                }
            } else {
                setError(result.error || 'Failed to load student copies');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    }

    const handleDeleteSession = async (sessionId: string) => {
        if (!confirm('Are you sure you want to delete this entire session and all its student copies?')) return;

        setDeleting(sessionId);
        try {
            const result = await deleteStudentCopySession(sessionId);
            if (result.success) {
                setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
            } else {
                alert(result.error || 'Failed to delete session');
            }
        } finally {
            setDeleting(null);
        }
    };

    const handleDeleteStudent = async (sessionId: string, cmsId: string) => {
        if (!confirm(`Are you sure you want to delete all copies for student ${cmsId}?`)) return;

        setDeleting(`${sessionId}-${cmsId}`);
        try {
            const result = await deleteStudentFromSession(sessionId, cmsId);
            if (result.success) {
                if (result.data?.sessionDeleted) {
                    setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
                } else {
                    setSessions(prev => prev.map(s => {
                        if (s.sessionId === sessionId) {
                            return {
                                ...s,
                                students: s.students.filter(st => st.cmsId !== cmsId)
                            };
                        }
                        return s;
                    }));
                }
            } else {
                alert(result.error || 'Failed to delete student copies');
            }
        } finally {
            setDeleting(null);
        }
    };

    const handleClearAll = async () => {
        if (!confirm('Are you sure you want to delete ALL student copies? This cannot be undone.')) return;

        setDeleting('all');
        try {
            const result = await clearAllStudentCopies();
            if (result.success) {
                setSessions([]);
            } else {
                alert(result.error || 'Failed to clear all copies');
            }
        } finally {
            setDeleting(null);
        }
    };

    const formatDate = (dateStr: string) => {
        try {
            if (dateStr.startsWith('session_')) {
                const parts = dateStr.replace('session_', '').split('_');
                if (parts.length >= 2) {
                    const datePart = parts[0];
                    const timePart = parts[1];
                    const year = datePart.substring(0, 4);
                    const month = datePart.substring(4, 6);
                    const day = datePart.substring(6, 8);
                    const hour = timePart.substring(0, 2);
                    const min = timePart.substring(2, 4);
                    const sec = timePart.substring(4, 6);
                    return `${year}-${month}-${day} ${hour}:${min}:${sec}`;
                }
            }
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                return date.toLocaleString();
            }
            return dateStr;
        } catch {
            return dateStr;
        }
    };

    const getTotalPages = (session: StudentCopySession) => {
        return session.students.reduce((acc, s) => acc + (s.totalPages || 0), 0);
    };

    const getTotalStudents = () => {
        return sessions.reduce((acc, s) => acc + s.students.length, 0);
    };

    const getTotalAllPages = () => {
        return sessions.reduce((acc, s) => acc + getTotalPages(s), 0);
    };

    const filteredSessions = sessions.filter(session => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        if (session.sessionId.toLowerCase().includes(query)) return true;
        return session.students.some(s =>
            s.cmsId.toLowerCase().includes(query) ||
            (s.name && s.name.toLowerCase().includes(query))
        );
    });

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h2>Student Copies</h2>
                    <p>View and manage processed student answer sheet PDFs</p>
                </div>
                <div className={styles.headerActions}>
                    <button
                        className="button secondary"
                        onClick={loadSessions}
                        disabled={loading}
                    >
                        🔄 Refresh
                    </button>
                    <button
                        className="button secondary"
                        onClick={() => onNavigate?.('upload-answer-sheets')}
                    >
                        📝 Upload New Sheets
                    </button>
                    {sessions.length > 0 && (
                        <button
                            className="button"
                            style={{ background: '#dc3545', borderColor: '#dc3545' }}
                            onClick={handleClearAll}
                            disabled={deleting === 'all'}
                        >
                            {deleting === 'all' ? 'Clearing...' : '🗑️ Clear All'}
                        </button>
                    )}
                </div>
            </div>

            {!loading && sessions.length > 0 && (
                <div className={styles.statsRow}>
                    <div className={styles.statCard}>
                        <span className={styles.statValue}>{sessions.length}</span>
                        <span className={styles.statLabel}>Sessions</span>
                    </div>
                    <div className={`${styles.statCard} ${styles.alt}`}>
                        <span className={styles.statValue}>{getTotalStudents()}</span>
                        <span className={styles.statLabel}>Students</span>
                    </div>
                    <div className={`${styles.statCard} ${styles.alt2}`}>
                        <span className={styles.statValue}>{getTotalAllPages()}</span>
                        <span className={styles.statLabel}>Total Pages</span>
                    </div>
                </div>
            )}

            {sessions.length > 0 && (
                <div className={styles.searchBar}>
                    <input
                        type="text"
                        className={styles.searchInput}
                        placeholder="Search by session ID or student CMS ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            )}

            {loading && (
                <div className="card">
                    <div className={styles.loading}>
                        <div className={styles.spinner}></div>
                        <span style={{ marginLeft: 12 }}>Loading student copies...</span>
                    </div>
                </div>
            )}

            {error && (
                <div className="card" style={{ color: '#dc3545', background: '#f8d7da', borderColor: '#f5c6cb' }}>
                    ⚠️ {error}
                </div>
            )}

            {!loading && !error && sessions.length === 0 && (
                <div className="card">
                    <div className={styles.emptyState}>
                        <div className={styles.icon}>📑</div>
                        <h3>No Student Copies Found</h3>
                        <p>Upload and process answer sheets to see student copies here.</p>
                        <button className="button" onClick={() => onNavigate?.('upload-answer-sheets')}>
                            Upload Answer Sheets
                        </button>
                    </div>
                </div>
            )}

            {!loading && filteredSessions.length === 0 && sessions.length > 0 && searchQuery && (
                <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                    <p>No results found for "{searchQuery}"</p>
                </div>
            )}

            {!loading && filteredSessions.map(session => (
                <div
                    key={session.sessionId}
                    className={`card ${styles.sessionCard}`}
                >
                    <div
                        className={styles.sessionHeader}
                        onClick={() => setExpandedSession(
                            expandedSession === session.sessionId ? null : session.sessionId
                        )}
                    >
                        <div className={styles.sessionInfo}>
                            <span className={styles.sessionToggle}>
                                {expandedSession === session.sessionId ? '▼' : '▶'}
                            </span>
                            <div>
                                <strong>Session: {formatDate(session.sessionId)}</strong>
                                <div className={styles.sessionMeta}>
                                    {session.students.length} students • {getTotalPages(session)} pages
                                </div>
                                {session.paperId && (
                                    <div className={styles.paperInfo}>
                                        📄 Paper: {typeof session.paperId === 'object' ? (session.paperId as any).name || 'Linked' : 'Linked'}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className={styles.sessionActions}>
                            <button
                                className="button secondary small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteSession(session.sessionId);
                                }}
                                disabled={deleting === session.sessionId}
                                style={{ color: '#dc3545' }}
                            >
                                {deleting === session.sessionId ? 'Deleting...' : '🗑️ Delete Session'}
                            </button>
                        </div>
                    </div>

                    {expandedSession === session.sessionId && (
                        <div className={styles.studentList}>
                            {session.students.map(student => (
                                <div key={student.cmsId} className={styles.studentCard}>
                                    <div
                                        className={styles.studentHeader}
                                        onClick={() => setExpandedStudent(
                                            expandedStudent === `${session.sessionId}-${student.cmsId}`
                                                ? null
                                                : `${session.sessionId}-${student.cmsId}`
                                        )}
                                    >
                                        <span className={styles.studentToggle}>
                                            {expandedStudent === `${session.sessionId}-${student.cmsId}` ? '▼' : '▶'}
                                        </span>
                                        <div className={styles.studentInfo}>
                                            <span className={styles.studentId}>📝 {student.cmsId}</span>
                                            {student.name && (
                                                <span className={styles.studentName}>{student.name}</span>
                                            )}
                                            <span className={styles.studentMeta}>
                                                {student.section && <span>Section: {student.section}</span>}
                                                {student.courseCode && <span> • {student.courseCode}</span>}
                                            </span>
                                        </div>
                                        <span className={styles.imageCount}>
                                            {student.totalPages || 0} pages
                                        </span>
                                        {student.pdfPath && (
                                            <a
                                                href={getStudentPdfUrl(session.sessionId, student.cmsId)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={styles.downloadBtn}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                ⬇️ Download PDF
                                            </a>
                                        )}
                                        <button
                                            className={styles.deleteStudentBtn}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteStudent(session.sessionId, student.cmsId);
                                            }}
                                            disabled={deleting === `${session.sessionId}-${student.cmsId}`}
                                        >
                                            {deleting === `${session.sessionId}-${student.cmsId}` ? '...' : '🗑️'}
                                        </button>
                                    </div>

                                    {expandedStudent === `${session.sessionId}-${student.cmsId}` && (
                                        <div className={styles.pdfContainer}>
                                            {student.pdfPath ? (
                                                <embed
                                                    src={getStudentPdfUrl(session.sessionId, student.cmsId)}
                                                    type="application/pdf"
                                                    className={styles.pdfEmbed}
                                                    title={`${student.cmsId} Answer Sheet`}
                                                />
                                            ) : (
                                                <div className={styles.noPdf}>
                                                    <p>PDF not available. This session may have been processed before PDF generation was enabled.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
