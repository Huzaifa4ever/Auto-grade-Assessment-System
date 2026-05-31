import React, { useState, useEffect } from 'react';
import { Course } from '../types';
import { getCourses, createCourse, updateCourse, deleteCourse, getMe, updateProfile, getLlmConfig, setLlmConfig, testLlmConnection, LlmConfig } from '../services/api';
import styles from './Settings.module.css';

type Props = { onProfileUpdate?: (name: string, token: string) => void };

const CEREBRAS_MODELS = ['gpt-oss-120b', 'zai-glm-4.7'];

const CUSTOM_PRESETS: Record<string, { label: string; endpoint: string; defaultModel: string }> = {
	'openai': { label: 'OpenAI', endpoint: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
	'cerebras': { label: 'Cerebras', endpoint: 'https://api.cerebras.ai/v1', defaultModel: 'gpt-oss-120b' },
	'gemini': { label: 'Google Gemini', endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: 'gemini-2.0-flash' },
	'other': { label: 'Other (manual endpoint)', endpoint: '', defaultModel: '' },
};

export default function Settings({ onProfileUpdate }: Props) {
	const [courses, setCourses] = useState<Course[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [searchTerm, setSearchTerm] = useState('');
	const [addModalOpen, setAddModalOpen] = useState(false);
	const [editModalOpen, setEditModalOpen] = useState(false);
	const [deleteModalOpen, setDeleteModalOpen] = useState(false);
	const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
	const [formData, setFormData] = useState({ courseCode: '', courseName: '', department: '' });
	const [formError, setFormError] = useState('');
	const [saving, setSaving] = useState(false);

	const [profileData, setProfileData] = useState({ name: '', email: '', userId: '', currentPassword: '', newPassword: '' });
	const [profileLoading, setProfileLoading] = useState(true);
	const [profileError, setProfileError] = useState('');
	const [profileSuccess, setProfileSuccess] = useState('');
	const [profileSaving, setProfileSaving] = useState(false);

	const [llmProvider, setLlmProvider] = useState('cerebras-free');
	const [llmModel, setLlmModel] = useState('gpt-oss-120b');
	const [llmApiKey, setLlmApiKey] = useState('');
	const [llmEndpoint, setLlmEndpoint] = useState('');
	const [customPreset, setCustomPreset] = useState('openai');
	const [llmRpm, setLlmRpm] = useState(5);
	const [llmTpm, setLlmTpm] = useState(30000);
	const [llmFallback, setLlmFallback] = useState(true);
	const [llmApiKeySet, setLlmApiKeySet] = useState(false);
	const [llmApiKeyPreview, setLlmApiKeyPreview] = useState('');
	const [llmLastStatus, setLlmLastStatus] = useState<string | null>(null);
	const [llmLoading, setLlmLoading] = useState(true);
	const [llmSaving, setLlmSaving] = useState(false);
	const [llmSuccess, setLlmSuccess] = useState('');
	const [llmError, setLlmError] = useState('');
	const [testingConnection, setTestingConnection] = useState(false);
	const [testResult, setTestResult] = useState<string | null>(null);
	const [showApiKey, setShowApiKey] = useState(false);

	useEffect(() => { loadCourses(); loadProfile(); loadLlmConfig(); }, []);

	async function loadCourses() {
		setLoading(true); setError(null);
		const response = await getCourses();
		if (response.success && response.data) setCourses(response.data);
		else setError(response.error || 'Failed to load courses');
		setLoading(false);
	}

	const filteredCourses = courses.filter(c =>
		c.courseCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
		c.courseName.toLowerCase().includes(searchTerm.toLowerCase()) ||
		c.department.toLowerCase().includes(searchTerm.toLowerCase())
	);

	async function loadProfile() {
		setProfileLoading(true);
		const token = localStorage.getItem('authToken');
		if (token) {
			const res = await getMe(token);
			if (res.success && res.data) {
				setProfileData(prev => ({ ...prev, name: res.data!.name, email: res.data!.email, userId: res.data!.userId }));
			}
		}
		setProfileLoading(false);
	}

	async function handleProfileSave(e: React.FormEvent) {
		e.preventDefault(); setProfileError(''); setProfileSuccess('');
		if (!profileData.name.trim() || !profileData.email.trim() || !profileData.userId.trim()) { setProfileError('Name, email, and User ID are required'); return; }
		if (!profileData.currentPassword) { setProfileError('Enter your current password to save changes'); return; }
		if (profileData.newPassword && profileData.newPassword.length < 5) { setProfileError('New password must be at least 5 characters'); return; }
		setProfileSaving(true);
		const res = await updateProfile({ name: profileData.name.trim(), email: profileData.email.trim(), userId: profileData.userId.trim(), currentPassword: profileData.currentPassword, newPassword: profileData.newPassword || undefined });
		setProfileSaving(false);
		if (res.success && res.data) {
			setProfileSuccess('Profile updated successfully!');
			setProfileData(prev => ({ ...prev, currentPassword: '', newPassword: '' }));
			localStorage.setItem('authToken', res.data.token);
			localStorage.setItem('teacherName', res.data.teacher.name);
			onProfileUpdate?.(res.data.teacher.name, res.data.token);
			setTimeout(() => setProfileSuccess(''), 3000);
		} else { setProfileError(res.error || 'Failed to update profile'); }
	}

	// LLM Config
	async function loadLlmConfig() {
		setLlmLoading(true);
		const res = await getLlmConfig();
		if (res.success && res.data) {
			const c = res.data;
			setLlmProvider(c.provider || 'cerebras-free');
			setLlmModel(c.model || 'gpt-oss-120b');
			setLlmApiKeySet(c.apiKeySet || false);
			setLlmApiKeyPreview(c.apiKeyPreview || '');
			setLlmEndpoint(c.endpoint || '');
			const matchedPreset = Object.entries(CUSTOM_PRESETS).find(([k, v]) => k !== 'other' && v.endpoint === c.endpoint);
			setCustomPreset(matchedPreset ? matchedPreset[0] : 'other');
			setLlmRpm(c.rpm || 5);
			setLlmTpm(c.tpm || 30000);
			setLlmFallback(c.fallbackEnabled !== false);
			setLlmLastStatus(c.lastStatus || null);
		}
		setLlmLoading(false);
	}

	async function handleSaveLlmConfig() {
		setLlmError(''); setLlmSuccess(''); setLlmSaving(true);
		const payload: any = { provider: llmProvider, model: llmModel, fallbackEnabled: llmFallback, rpm: llmRpm, tpm: llmTpm };
		if (llmApiKey) payload.apiKey = llmApiKey;
		if (llmProvider === 'custom') payload.endpoint = llmEndpoint;
		const res = await setLlmConfig(payload);
		setLlmSaving(false);
		if (res.success && res.data) {
			setLlmSuccess('Configuration saved!');
			setLlmApiKey('');
			setLlmApiKeySet(res.data.apiKeySet || false);
			setLlmApiKeyPreview(res.data.apiKeyPreview || '');
			setTimeout(() => setLlmSuccess(''), 3000);
		} else { setLlmError(res.error || 'Failed to save'); }
	}

	async function handleTestConnection() {
		setTestingConnection(true); setTestResult(null); setLlmError('');
		const params: any = { provider: llmProvider, model: llmModel };
		if (llmApiKey) params.apiKey = llmApiKey;
		if (llmProvider === 'custom') params.endpoint = llmEndpoint;
		const res = await testLlmConnection(params);
		setTestingConnection(false);
		if (res.success && res.data) {
			setTestResult(`✅ ${res.data.message}`);
			setLlmLastStatus('connected');
			if (res.data.detectedRpm) setLlmRpm(res.data.detectedRpm);
			if (res.data.detectedTpm) setLlmTpm(res.data.detectedTpm);
		} else {
			setTestResult(`❌ ${res.error || 'Connection failed'}`);
			setLlmLastStatus('error');
		}
	}

	function getProcessingMode(rpm: number) {
		if (rpm >= 60) return 'Parallel (4x)';
		if (rpm >= 30) return 'Parallel (3x)';
		if (rpm >= 15) return 'Parallel (2x)';
		return 'Sequential';
	}

	function getProviderLabel(p: string) {
		if (p === 'cerebras-free') return 'Cerebras (Free)';
		return 'Custom Provider';
	}

	function handleAddClick() { setFormData({ courseCode: '', courseName: '', department: '' }); setFormError(''); setAddModalOpen(true); }
	function handleEditClick(course: Course) { setSelectedCourse(course); setFormData({ courseCode: course.courseCode, courseName: course.courseName, department: course.department }); setFormError(''); setEditModalOpen(true); }
	function handleDeleteClick(course: Course) { setSelectedCourse(course); setDeleteModalOpen(true); }

	async function handleAddSubmit(e: React.FormEvent) {
		e.preventDefault(); setFormError('');
		if (!formData.courseCode || !formData.courseName || !formData.department) { setFormError('All fields are required'); return; }
		if (!/^[A-Z]{3}\s+\d{3}$/.test(formData.courseCode.toUpperCase())) { setFormError('Course code must be in format: ABC 123'); return; }
		setSaving(true);
		const response = await createCourse({ courseCode: formData.courseCode.toUpperCase(), courseName: formData.courseName, department: formData.department });
		if (response.success) { await loadCourses(); setAddModalOpen(false); } else { setFormError(response.error || 'Failed to create course'); }
		setSaving(false);
	}

	async function handleEditSubmit(e: React.FormEvent) {
		e.preventDefault(); if (!selectedCourse) return; setFormError('');
		if (!formData.courseCode || !formData.courseName || !formData.department) { setFormError('All fields are required'); return; }
		if (!/^[A-Z]{3}\s+\d{3}$/.test(formData.courseCode.toUpperCase())) { setFormError('Course code must be in format: ABC 123'); return; }
		setSaving(true);
		const response = await updateCourse(selectedCourse._id!, { courseCode: formData.courseCode.toUpperCase(), courseName: formData.courseName, department: formData.department });
		if (response.success) { await loadCourses(); setEditModalOpen(false); } else { setFormError(response.error || 'Failed to update course'); }
		setSaving(false);
	}

	async function handleDeleteConfirm() {
		if (!selectedCourse) return; setSaving(true);
		const response = await deleteCourse(selectedCourse._id!);
		if (response.success) { await loadCourses(); setDeleteModalOpen(false); } else { setError(response.error || 'Failed to delete course'); }
		setSaving(false);
	}

	return (
		<div className={styles.page}>
			<div className={styles.pageHeader}>
				<h2>Settings</h2>
				<p>Manage your profile and system settings</p>
			</div>

			<div className="card" style={{ marginBottom: 24 }}>
				<div className={styles.sectionHeader}>
					<div><h3>👤 Profile Management</h3><p className="small">Update your profile information</p></div>
				</div>
				{profileLoading ? (<div className={styles.loading}>Loading profile...</div>) : (
					<form onSubmit={handleProfileSave}>
						{profileError && <div className={styles.formError}>{profileError}</div>}
						{profileSuccess && <div className={styles.formSuccess}>{profileSuccess}</div>}
						<div className={styles.profileGrid}>
							<div className={styles.formField}><label>Full Name</label><input type="text" value={profileData.name} onChange={e => setProfileData({ ...profileData, name: e.target.value })} placeholder="Your full name" /></div>
							<div className={styles.formField}><label>Email</label><input type="email" value={profileData.email} onChange={e => setProfileData({ ...profileData, email: e.target.value })} placeholder="your@email.com" /></div>
							<div className={styles.formField}><label>User ID</label><input type="text" value={profileData.userId} onChange={e => setProfileData({ ...profileData, userId: e.target.value })} placeholder="Your User ID" /></div>
							<div className={styles.formField}><label>New Password <span className="small" style={{ fontWeight: 400, color: '#94a3b8' }}>(leave blank to keep current)</span></label><input type="password" value={profileData.newPassword} onChange={e => setProfileData({ ...profileData, newPassword: e.target.value })} placeholder="Min 5 characters" /></div>
						</div>
						<div className={styles.profileSaveRow}>
							<div className={styles.formField} style={{ flex: 1, marginBottom: 0 }}><label>Current Password <span style={{ color: 'red' }}>*</span></label><input type="password" value={profileData.currentPassword} onChange={e => setProfileData({ ...profileData, currentPassword: e.target.value })} placeholder="Required to save changes" /></div>
							<button type="submit" className="button" disabled={profileSaving} style={{ alignSelf: 'flex-end' }}>{profileSaving ? 'Saving...' : '💾 Save Changes'}</button>
						</div>
					</form>
				)}
			</div>

			<div className="card" style={{ marginBottom: 24 }}>
				<div className={styles.sectionHeader}>
					<div><h3>🤖 LLM Evaluation Engine</h3><p className="small">Configure the AI model used for grading answer sheets</p></div>
				</div>

				{llmError && <div className={styles.formError}>{llmError}</div>}
				{llmSuccess && <div className={styles.formSuccess}>{llmSuccess}</div>}

				{llmLoading ? (<div className={styles.loading}>Loading configuration...</div>) : (
					<>
						<div className={styles.formField}>
							<label>Provider</label>
							<div className={styles.providerGrid}>
								{(['cerebras-free', 'custom'] as const).map(p => (
									<div key={p} className={`${styles.providerCard} ${llmProvider === p ? styles.providerCardActive : ''}`}
										onClick={() => {
											setLlmProvider(p);
											if (p === 'cerebras-free') setLlmModel('gpt-oss-120b');
											setTestResult(null);
										}}>
										<div className={styles.providerDot}>{llmProvider === p && <div className={styles.providerDotInner} />}</div>
										<div>
											<div className={styles.providerName}>{getProviderLabel(p)}</div>
											<div className={styles.providerDesc}>
												{p === 'cerebras-free' && 'Free · 5 RPM · No key needed'}
												{p === 'custom' && 'Your own API key & endpoint'}
											</div>
										</div>
									</div>
								))}
							</div>
						</div>

						{llmProvider === 'custom' && (
							<>
								<div className={styles.formField}>
									<label>API Provider</label>
									<select value={customPreset} onChange={e => {
										const p = e.target.value;
										setCustomPreset(p);
										const preset = CUSTOM_PRESETS[p];
										if (preset) {
											setLlmEndpoint(preset.endpoint);
											if (preset.defaultModel) setLlmModel(preset.defaultModel);
										}
									}} className={styles.selectInput}>
										{Object.entries(CUSTOM_PRESETS).map(([k, v]) => (
											<option key={k} value={k}>{v.label}</option>
										))}
									</select>
								</div>

								<div className={styles.formField}>
									<label>API Key {llmApiKeySet && <span className={styles.keyBadge}>✓ Key saved: {llmApiKeyPreview}</span>}</label>
									<div className={styles.apiKeyRow}>
										<input type={showApiKey ? 'text' : 'password'} value={llmApiKey} onChange={e => setLlmApiKey(e.target.value)}
											placeholder={llmApiKeySet ? 'Enter new key to replace existing' : 'Enter your API key'} />
										<button type="button" className={styles.eyeBtn} onClick={() => setShowApiKey(!showApiKey)}>{showApiKey ? '🙈' : '👁'}</button>
									</div>
								</div>

								{customPreset === 'other' && (
									<div className={styles.formField}>
										<label>API Endpoint</label>
										<input type="text" value={llmEndpoint} onChange={e => setLlmEndpoint(e.target.value)} placeholder="https://api.example.com/v1" />
									</div>
								)}
							</>
						)}

						<div className={styles.formField}>
							<label>Model</label>
							{llmProvider === 'cerebras-free' ? (
								<div className={styles.modelGrid}>
									{CEREBRAS_MODELS.map(m => (
										<div key={m} className={`${styles.modelCard} ${llmModel === m ? styles.modelCardActive : ''}`} onClick={() => setLlmModel(m)}>
											<div className={styles.modelRadio}><div className={`${styles.radioCircle} ${llmModel === m ? styles.radioActive : ''}`}>{llmModel === m && <div className={styles.radioDot} />}</div></div>
											<div className={styles.modelInfo}>
												<div className={styles.modelName}>{m === 'gpt-oss-120b' ? 'OpenAI GPT OSS' : 'Z.ai GLM 4.7'}</div>
												<div className={styles.modelId}>{m}</div>
												<div className={styles.modelMeta}>
													<span className={styles.modelBadge} style={{ background: m === 'gpt-oss-120b' ? '#dcfce7' : '#fef3c7', color: m === 'gpt-oss-120b' ? '#16a34a' : '#b45309' }}>{m === 'gpt-oss-120b' ? 'Production' : 'Preview'}</span>
													<span className={styles.modelCtx}>{m === 'gpt-oss-120b' ? '65,536' : '64,000'} ctx</span>
												</div>
											</div>
										</div>
									))}
								</div>
							) : (
								<input type="text" value={llmModel} onChange={e => setLlmModel(e.target.value)} placeholder="Enter model name (e.g. gpt-4o-mini)" />
							)}
						</div>

						<div className={styles.formField}>
							<label className={styles.checkboxLabel}>
								<input type="checkbox" checked={llmFallback} onChange={e => setLlmFallback(e.target.checked)} />
								Enable fallback to built-in model when primary fails
							</label>
						</div>

						<div className={styles.llmActions}>
							<button className="button" onClick={handleSaveLlmConfig} disabled={llmSaving}>
								{llmSaving ? 'Saving...' : '💾 Save Configuration'}
							</button>
							<button className={styles.testBtn} onClick={handleTestConnection} disabled={testingConnection}>
								{testingConnection ? '⏳ Testing...' : '🔌 Test Connection'}
							</button>
						</div>

						{testResult && <div className={styles.testResult}>{testResult}</div>}

						<div className={styles.statusPanel}>
							<div className={styles.statusTitle}>📊 Current Status</div>
							<div className={styles.statusGrid}>
								<div className={styles.statusItem}><span className={styles.statusLabel}>Provider</span><span className={styles.statusValue}>{getProviderLabel(llmProvider)}</span></div>
								<div className={styles.statusItem}><span className={styles.statusLabel}>Model</span><span className={styles.statusValue}>{llmModel}</span></div>
								<div className={styles.statusItem}><span className={styles.statusLabel}>Status</span><span className={styles.statusValue}>
									{llmLastStatus === 'connected' ? <span style={{ color: '#16a34a' }}>● Connected</span> : llmLastStatus === 'error' ? <span style={{ color: '#dc2626' }}>● Error</span> : <span style={{ color: '#94a3b8' }}>● Not tested</span>}
								</span></div>
								<div className={styles.statusItem}><span className={styles.statusLabel}>Quota</span><span className={styles.statusValue}>{llmRpm} RPM · {(llmTpm / 1000).toFixed(0)}K TPM</span></div>
								<div className={styles.statusItem}><span className={styles.statusLabel}>Processing</span><span className={styles.statusValue}>{getProcessingMode(llmRpm)}</span></div>
								<div className={styles.statusItem}><span className={styles.statusLabel}>Fallback</span><span className={styles.statusValue}>{llmFallback ? '✅ Enabled' : '❌ Disabled'}</span></div>
							</div>
						</div>
					</>
				)}
			</div>

			<div className="card" style={{ marginBottom: 24 }}>
				<div className={styles.sectionHeader}>
					<div><h3>Course Management</h3><p className="small">Manage courses available in the system</p></div>
					<button className="button" onClick={handleAddClick}>➕ Add New Course</button>
				</div>
				<div className={styles.searchSection}><input type="text" className={styles.searchInput} placeholder="Search courses..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
				{loading && <div className={styles.loading}>Loading courses...</div>}
				{error && <div className={styles.error}>{error}</div>}
				{!loading && !error && (
					<div className={styles.tableWrapper}>
						<table className={styles.courseTable}>
							<thead><tr><th>Course Code</th><th>Course Name</th><th>Department</th><th>Actions</th></tr></thead>
							<tbody>
								{filteredCourses.length === 0 ? (
									<tr><td colSpan={4} className={styles.noResults}>{searchTerm ? `No courses found for "${searchTerm}"` : 'No courses available'}</td></tr>
								) : (filteredCourses.map((course) => (
									<tr key={course._id}>
										<td className={styles.courseCode}>{course.courseCode}</td>
										<td>{course.courseName}</td>
										<td className={styles.department}>{course.department}</td>
										<td className={styles.actions}>
											<button className={styles.editButton} onClick={() => handleEditClick(course)}>Edit</button>
											<button className={styles.deleteButton} onClick={() => handleDeleteClick(course)}>Delete</button>
										</td>
									</tr>
								)))}
							</tbody>
						</table>
					</div>
				)}
				<div className={styles.tableFooter}><span className="small">Showing {filteredCourses.length} of {courses.length} courses</span></div>
			</div>

			{addModalOpen && (
				<div className={styles.modalOverlay} onClick={() => setAddModalOpen(false)}>
					<div className={styles.modal} onClick={(e) => e.stopPropagation()}>
						<div className={styles.modalHeader}><h3>Add New Course</h3><button className={styles.closeButton} onClick={() => setAddModalOpen(false)}>✕</button></div>
						<form onSubmit={handleAddSubmit}>
							<div className={styles.modalBody}>
								{formError && <div className={styles.formError}>{formError}</div>}
								<div className={styles.formField}><label>Course Code <span style={{ color: 'red' }}>*</span></label><input type="text" placeholder="e.g., CSC 450" value={formData.courseCode} onChange={(e) => setFormData({ ...formData, courseCode: e.target.value })} autoFocus /><p className="small">Format: ABC 123 (3 letters, space, 3 digits)</p></div>
								<div className={styles.formField}><label>Course Name <span style={{ color: 'red' }}>*</span></label><input type="text" placeholder="e.g., Database Management Systems" value={formData.courseName} onChange={(e) => setFormData({ ...formData, courseName: e.target.value })} /></div>
								<div className={styles.formField}><label>Department <span style={{ color: 'red' }}>*</span></label><input type="text" placeholder="e.g., Computer Science" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} /></div>
							</div>
							<div className={styles.modalFooter}><button type="button" className="button secondary" onClick={() => setAddModalOpen(false)} disabled={saving}>Cancel</button><button type="submit" className="button" disabled={saving}>{saving ? 'Adding...' : 'Add Course'}</button></div>
						</form>
					</div>
				</div>
			)}
			{editModalOpen && (
				<div className={styles.modalOverlay} onClick={() => setEditModalOpen(false)}>
					<div className={styles.modal} onClick={(e) => e.stopPropagation()}>
						<div className={styles.modalHeader}><h3>Edit Course</h3><button className={styles.closeButton} onClick={() => setEditModalOpen(false)}>✕</button></div>
						<form onSubmit={handleEditSubmit}>
							<div className={styles.modalBody}>
								{formError && <div className={styles.formError}>{formError}</div>}
								<div className={styles.formField}><label>Course Code <span style={{ color: 'red' }}>*</span></label><input type="text" placeholder="e.g., CSC 450" value={formData.courseCode} onChange={(e) => setFormData({ ...formData, courseCode: e.target.value })} autoFocus /><p className="small">Format: ABC 123 (3 letters, space, 3 digits)</p></div>
								<div className={styles.formField}><label>Course Name <span style={{ color: 'red' }}>*</span></label><input type="text" placeholder="e.g., Database Management Systems" value={formData.courseName} onChange={(e) => setFormData({ ...formData, courseName: e.target.value })} /></div>
								<div className={styles.formField}><label>Department <span style={{ color: 'red' }}>*</span></label><input type="text" placeholder="e.g., Computer Science" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} /></div>
							</div>
							<div className={styles.modalFooter}><button type="button" className="button secondary" onClick={() => setEditModalOpen(false)} disabled={saving}>Cancel</button><button type="submit" className="button" disabled={saving}>{saving ? 'Updating...' : 'Update Course'}</button></div>
						</form>
					</div>
				</div>
			)}
			{deleteModalOpen && selectedCourse && (
				<div className={styles.modalOverlay} onClick={() => setDeleteModalOpen(false)}>
					<div className={styles.modalSmall} onClick={(e) => e.stopPropagation()}>
						<div className={styles.modalHeader}><h3>Delete Course</h3><button className={styles.closeButton} onClick={() => setDeleteModalOpen(false)}>✕</button></div>
						<div className={styles.modalBody}>
							<p>Are you sure you want to delete this course?</p>
							<div className={styles.deleteCourseInfo}><strong>{selectedCourse.courseCode}</strong> - {selectedCourse.courseName}</div>
							<p className="small" style={{ color: '#666', marginTop: 8 }}>This action cannot be undone.</p>
						</div>
						<div className={styles.modalFooter}>
							<button type="button" className="button secondary" onClick={() => setDeleteModalOpen(false)} disabled={saving}>Cancel</button>
							<button type="button" className={styles.deleteConfirmButton} onClick={handleDeleteConfirm} disabled={saving}>{saving ? 'Deleting...' : 'Delete'}</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
