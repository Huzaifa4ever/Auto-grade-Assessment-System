import React, { useEffect, useState, useCallback } from 'react';
import styles from './IndividualAnswerSheets.module.css';
import {
    getAnswerSheetSessions,
    deleteAnswerSheetSession,
    clearAllAnswerSheets,
    getAnswerSheetImageUrl,
    SessionData
} from '../services/api';

interface Props {
    onNavigate?: (page: string) => void;
}

export default function IndividualAnswerSheets({ onNavigate }: Props) {
    const [sessions, setSessions] = useState<SessionData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedSession, setExpandedSession] = useState<string | null>(null);
    const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);

    const [currentImages, setCurrentImages] = useState<string[]>([]);
    const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
    const [showModal, setShowModal] = useState(false);

    const handlePrevImage = useCallback(() => {
        if (currentImageIndex > 0) {
            setCurrentImageIndex(prev => prev - 1);
        }
    }, [currentImageIndex]);

    const handleNextImage = useCallback(() => {
        if (currentImageIndex < currentImages.length - 1) {
            setCurrentImageIndex(prev => prev + 1);
        }
    }, [currentImageIndex, currentImages.length]);

    const closeModal = useCallback(() => {
        setShowModal(false);
        setCurrentImages([]);
        setCurrentImageIndex(0);
    }, []);

    useEffect(() => {
        loadSessions();
    }, []);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!showModal) return;

            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                handlePrevImage();
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                handleNextImage();
            } else if (e.key === 'Escape') {
                closeModal();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showModal, handlePrevImage, handleNextImage, closeModal]);

    async function loadSessions() {
        setLoading(true);
        setError(null);

        try {
            const result = await getAnswerSheetSessions();
            if (result.success && result.data) {
                setSessions(result.data);
                if (result.data.length > 0) {
                    setExpandedSession(result.data[0].session_id);
                }
            } else {
                setError(result.error || 'Failed to load sessions');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    }

    const handleDeleteSession = async (sessionId: string) => {
        if (!confirm('Are you sure you want to delete this session?')) return;

        setDeleting(sessionId);
        try {
            const result = await deleteAnswerSheetSession(sessionId);
            if (result.success) {
                setSessions(prev => prev.filter(s => s.session_id !== sessionId));
            } else {
                alert(result.error || 'Failed to delete session');
            }
        } finally {
            setDeleting(null);
        }
    };

    const handleClearAll = async () => {
        if (!confirm('Are you sure you want to delete ALL processed sheets? This cannot be undone.')) return;

        setDeleting('all');
        try {
            const result = await clearAllAnswerSheets();
            if (result.success) {
                setSessions([]);
            } else {
                alert(result.error || 'Failed to clear all sheets');
            }
        } finally {
            setDeleting(null);
        }
    };

    const openImageViewer = (images: string[], startIndex: number) => {
        setCurrentImages(images);
        setCurrentImageIndex(startIndex);
        setShowModal(true);
    };

    const formatDate = (dateStr: string) => {
        try {
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            const hour = dateStr.substring(9, 11);
            const min = dateStr.substring(11, 13);
            const sec = dateStr.substring(13, 15);
            return `${year}-${month}-${day} ${hour}:${min}:${sec}`;
        } catch {
            return dateStr;
        }
    };

    const getTotalImages = (session: SessionData) => {
        return session.students.reduce((acc, s) => acc + s.cropped_images.length, 0);
    };

    const currentImage = currentImages[currentImageIndex];

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h2>Individual Answer Sheets</h2>
                    <p>View and manage processed student answer sheets</p>
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
                        ← Back to Upload
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

            {loading && (
                <div className="card">
                    <div className={styles.loading}>Loading sessions...</div>
                </div>
            )}

            {error && (
                <div className="card" style={{ color: '#dc3545', background: '#f8d7da', borderColor: '#f5c6cb' }}>
                    ⚠️ {error}
                </div>
            )}

            {!loading && !error && sessions.length === 0 && (
                <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
                    <h3>No Processed Sheets</h3>
                    <p>Upload and process answer sheets to see them here.</p>
                    <button className="button" onClick={() => onNavigate?.('upload-answer-sheets')}>
                        Upload Answer Sheets
                    </button>
                </div>
            )}

            {!loading && sessions.map(session => (
                <div
                    key={session.session_id}
                    className={`card ${styles.sessionCard}`}
                >
                    <div
                        className={styles.sessionHeader}
                        onClick={() => setExpandedSession(
                            expandedSession === session.session_id ? null : session.session_id
                        )}
                    >
                        <div className={styles.sessionInfo}>
                            <span className={styles.sessionToggle}>
                                {expandedSession === session.session_id ? '▼' : '▶'}
                            </span>
                            <div>
                                <strong>Session: {formatDate(session.created_at)}</strong>
                                <div className={styles.sessionMeta}>
                                    {session.students.length} students • {getTotalImages(session)} images
                                </div>
                            </div>
                        </div>
                        <button
                            className="button secondary small"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSession(session.session_id);
                            }}
                            disabled={deleting === session.session_id}
                            style={{ color: '#dc3545' }}
                        >
                            {deleting === session.session_id ? 'Deleting...' : '🗑️ Delete'}
                        </button>
                    </div>

                    {expandedSession === session.session_id && (
                        <div className={styles.studentList}>
                            {session.students.map(student => (
                                <div key={student.cms_id} className={styles.studentCard}>
                                    <div
                                        className={styles.studentHeader}
                                        onClick={() => setExpandedStudent(
                                            expandedStudent === `${session.session_id}-${student.cms_id}`
                                                ? null
                                                : `${session.session_id}-${student.cms_id}`
                                        )}
                                    >
                                        <span className={styles.studentToggle}>
                                            {expandedStudent === `${session.session_id}-${student.cms_id}` ? '▼' : '▶'}
                                        </span>
                                        <span className={styles.studentId}>📝 {student.cms_id}</span>
                                        <span className={styles.imageCount}>
                                            {student.cropped_images.length} cropped images
                                        </span>
                                        {student.has_cover && (
                                            <span className={styles.coverBadge}>Has Cover</span>
                                        )}
                                    </div>

                                    {expandedStudent === `${session.session_id}-${student.cms_id}` && (
                                        <div className={styles.imageGrid}>
                                            {student.cropped_images.map((imgPath, idx) => (
                                                <div
                                                    key={idx}
                                                    className={styles.imageThumb}
                                                    onClick={() => openImageViewer(student.cropped_images, idx)}
                                                >
                                                    <img
                                                        src={getAnswerSheetImageUrl(imgPath)}
                                                        alt={`Page ${idx + 1}`}
                                                        loading="lazy"
                                                    />
                                                    <div className={styles.imageLabel}>
                                                        {imgPath.split('/').pop()?.replace('.jpg', '')}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}

            {showModal && currentImage && (
                <div className={styles.modal} onClick={closeModal}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <button className={styles.modalClose} onClick={closeModal}>
                            ✕
                        </button>

                        <button
                            className={`${styles.navButton} ${styles.navPrev}`}
                            onClick={handlePrevImage}
                            disabled={currentImageIndex === 0}
                            title="Previous (←)"
                        >
                            ‹
                        </button>

                        <button
                            className={`${styles.navButton} ${styles.navNext}`}
                            onClick={handleNextImage}
                            disabled={currentImageIndex === currentImages.length - 1}
                            title="Next (→)"
                        >
                            ›
                        </button>

                        <img
                            src={getAnswerSheetImageUrl(currentImage)}
                            alt="Full size"
                            className={styles.modalImage}
                        />

                        <div className={styles.modalLabel}>
                            <span>{currentImage.split('/').pop()}</span>
                            <span className={styles.pageIndicator}>
                                {currentImageIndex + 1} / {currentImages.length}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
