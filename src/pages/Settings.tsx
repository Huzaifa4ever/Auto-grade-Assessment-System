import React, { useState, useEffect } from 'react';
import { Course } from '../types';
import { getCourses, createCourse, updateCourse, deleteCourse, getMe, updateProfile } from '../services/api';
import styles from './Settings.module.css';

type Props = {
	onProfileUpdate?: (name: string, token: string) => void;
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

	const [formData, setFormData] = useState({
		courseCode: '',
		courseName: '',
		department: ''
	});
	const [formError, setFormError] = useState('');
	const [saving, setSaving] = useState(false);

	// Profile state
	const [profileData, setProfileData] = useState({
		name: '',
		email: '',
		userId: '',
		currentPassword: '',
		newPassword: ''
	});
	const [profileLoading, setProfileLoading] = useState(true);
	const [profileError, setProfileError] = useState('');
	const [profileSuccess, setProfileSuccess] = useState('');
	const [profileSaving, setProfileSaving] = useState(false);

	useEffect(() => {
		loadCourses();
		loadProfile();
	}, []);

	async function loadCourses() {
		setLoading(true);
		setError(null);
		const response = await getCourses();
		if (response.success && response.data) {
			setCourses(response.data);
		} else {
			setError(response.error || 'Failed to load courses');
		}
		setLoading(false);
	}

	const filteredCourses = courses.filter(course =>
		course.courseCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
		course.courseName.toLowerCase().includes(searchTerm.toLowerCase()) ||
		course.department.toLowerCase().includes(searchTerm.toLowerCase())
	);

	async function loadProfile() {
		setProfileLoading(true);
		const token = localStorage.getItem('authToken');
		if (token) {
			const res = await getMe(token);
			if (res.success && res.data) {
				setProfileData(prev => ({
					...prev,
					name: res.data!.name,
					email: res.data!.email,
					userId: res.data!.userId
				}));
			}
		}
		setProfileLoading(false);
	}

	async function handleProfileSave(e: React.FormEvent) {
		e.preventDefault();
		setProfileError('');
		setProfileSuccess('');

		if (!profileData.name.trim() || !profileData.email.trim() || !profileData.userId.trim()) {
			setProfileError('Name, email, and User ID are required');
			return;
		}

		if (!profileData.currentPassword) {
			setProfileError('Enter your current password to save changes');
			return;
		}

		if (profileData.newPassword && profileData.newPassword.length < 5) {
			setProfileError('New password must be at least 5 characters');
			return;
		}

		setProfileSaving(true);
		const res = await updateProfile({
			name: profileData.name.trim(),
			email: profileData.email.trim(),
			userId: profileData.userId.trim(),
			currentPassword: profileData.currentPassword,
			newPassword: profileData.newPassword || undefined
		});
		setProfileSaving(false);

		if (res.success && res.data) {
			setProfileSuccess('Profile updated successfully!');
			setProfileData(prev => ({ ...prev, currentPassword: '', newPassword: '' }));
			// Update token and name in app
			localStorage.setItem('authToken', res.data.token);
			localStorage.setItem('teacherName', res.data.teacher.name);
			onProfileUpdate?.(res.data.teacher.name, res.data.token);
			setTimeout(() => setProfileSuccess(''), 3000);
		} else {
			setProfileError(res.error || 'Failed to update profile');
		}
	}

	function handleAddClick() {
		setFormData({ courseCode: '', courseName: '', department: '' });
		setFormError('');
		setAddModalOpen(true);
	}

	function handleEditClick(course: Course) {
		setSelectedCourse(course);
		setFormData({
			courseCode: course.courseCode,
			courseName: course.courseName,
			department: course.department
		});
		setFormError('');
		setEditModalOpen(true);
	}

	function handleDeleteClick(course: Course) {
		setSelectedCourse(course);
		setDeleteModalOpen(true);
	}

	async function handleAddSubmit(e: React.FormEvent) {
		e.preventDefault();
		setFormError('');

		if (!formData.courseCode || !formData.courseName || !formData.department) {
			setFormError('All fields are required');
			return;
		}

		if (!/^[A-Z]{3}\s+\d{3}$/.test(formData.courseCode.toUpperCase())) {
			setFormError('Course code must be in format: ABC 123 (3 letters, space, 3 digits)');
			return;
		}

		setSaving(true);
		const response = await createCourse({
			courseCode: formData.courseCode.toUpperCase(),
			courseName: formData.courseName,
			department: formData.department
		});

		if (response.success) {
			await loadCourses();
			setAddModalOpen(false);
		} else {
			setFormError(response.error || 'Failed to create course');
		}
		setSaving(false);
	}

	async function handleEditSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!selectedCourse) return;
		setFormError('');

		if (!formData.courseCode || !formData.courseName || !formData.department) {
			setFormError('All fields are required');
			return;
		}

		if (!/^[A-Z]{3}\s+\d{3}$/.test(formData.courseCode.toUpperCase())) {
			setFormError('Course code must be in format: ABC 123 (3 letters, space, 3 digits)');
			return;
		}

		setSaving(true);
		const response = await updateCourse(selectedCourse._id!, {
			courseCode: formData.courseCode.toUpperCase(),
			courseName: formData.courseName,
			department: formData.department
		});

		if (response.success) {
			await loadCourses();
			setEditModalOpen(false);
		} else {
			setFormError(response.error || 'Failed to update course');
		}
		setSaving(false);
	}

	async function handleDeleteConfirm() {
		if (!selectedCourse) return;
		setSaving(true);
		const response = await deleteCourse(selectedCourse._id!);

		if (response.success) {
			await loadCourses();
			setDeleteModalOpen(false);
		} else {
			setError(response.error || 'Failed to delete course');
		}
		setSaving(false);
	}

	return (
		<div className={styles.page}>
			<div className={styles.pageHeader}>
				<h2>Settings</h2>
				<p>Manage your profile and system settings</p>
			</div>

			{/* Profile Management */}
			<div className="card" style={{ marginBottom: 24 }}>
				<div className={styles.sectionHeader}>
					<div>
						<h3>👤 Profile Management</h3>
						<p className="small">Update your profile information</p>
					</div>
				</div>

				{profileLoading ? (
					<div className={styles.loading}>Loading profile...</div>
				) : (
					<form onSubmit={handleProfileSave}>
						{profileError && <div className={styles.formError}>{profileError}</div>}
						{profileSuccess && <div className={styles.formSuccess}>{profileSuccess}</div>}

						<div className={styles.profileGrid}>
							<div className={styles.formField}>
								<label>Full Name</label>
								<input
									type="text"
									value={profileData.name}
									onChange={e => setProfileData({ ...profileData, name: e.target.value })}
									placeholder="Your full name"
								/>
							</div>

							<div className={styles.formField}>
								<label>Email</label>
								<input
									type="email"
									value={profileData.email}
									onChange={e => setProfileData({ ...profileData, email: e.target.value })}
									placeholder="your@email.com"
								/>
							</div>

							<div className={styles.formField}>
								<label>User ID</label>
								<input
									type="text"
									value={profileData.userId}
									onChange={e => setProfileData({ ...profileData, userId: e.target.value })}
									placeholder="Your User ID"
								/>
							</div>

							<div className={styles.formField}>
								<label>New Password <span className="small" style={{ fontWeight: 400, color: '#94a3b8' }}>(leave blank to keep current)</span></label>
								<input
									type="password"
									value={profileData.newPassword}
									onChange={e => setProfileData({ ...profileData, newPassword: e.target.value })}
									placeholder="Min 5 characters"
								/>
							</div>
						</div>

						<div className={styles.profileSaveRow}>
							<div className={styles.formField} style={{ flex: 1, marginBottom: 0 }}>
								<label>Current Password <span style={{ color: 'red' }}>*</span></label>
								<input
									type="password"
									value={profileData.currentPassword}
									onChange={e => setProfileData({ ...profileData, currentPassword: e.target.value })}
									placeholder="Required to save changes"
								/>
							</div>
							<button type="submit" className="button" disabled={profileSaving} style={{ alignSelf: 'flex-end' }}>
								{profileSaving ? 'Saving...' : '💾 Save Changes'}
							</button>
						</div>
					</form>
				)}
			</div>

			<div className="card" style={{ marginBottom: 24 }}>
				<div className={styles.sectionHeader}>
					<div>
						<h3>Course Management</h3>
						<p className="small">Manage courses available in the system</p>
					</div>
					<button className="button" onClick={handleAddClick}>
						➕ Add New Course
					</button>
				</div>

				<div className={styles.searchSection}>
					<input
						type="text"
						className={styles.searchInput}
						placeholder="Search courses..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
					/>
				</div>

				{loading && <div className={styles.loading}>Loading courses...</div>}
				{error && <div className={styles.error}>{error}</div>}

				{!loading && !error && (
					<div className={styles.tableWrapper}>
						<table className={styles.courseTable}>
							<thead>
								<tr>
									<th>Course Code</th>
									<th>Course Name</th>
									<th>Department</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody>
								{filteredCourses.length === 0 ? (
									<tr>
										<td colSpan={4} className={styles.noResults}>
											{searchTerm ? `No courses found for "${searchTerm}"` : 'No courses available'}
										</td>
									</tr>
								) : (
									filteredCourses.map((course) => (
										<tr key={course._id}>
											<td className={styles.courseCode}>{course.courseCode}</td>
											<td>{course.courseName}</td>
											<td className={styles.department}>{course.department}</td>
											<td className={styles.actions}>
												<button
													className={styles.editButton}
													onClick={() => handleEditClick(course)}
												>
													Edit
												</button>
												<button
													className={styles.deleteButton}
													onClick={() => handleDeleteClick(course)}
												>
													Delete
												</button>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				)}

				<div className={styles.tableFooter}>
					<span className="small">
						Showing {filteredCourses.length} of {courses.length} courses
					</span>
				</div>
			</div>

			{addModalOpen && (
				<div className={styles.modalOverlay} onClick={() => setAddModalOpen(false)}>
					<div className={styles.modal} onClick={(e) => e.stopPropagation()}>
						<div className={styles.modalHeader}>
							<h3>Add New Course</h3>
							<button className={styles.closeButton} onClick={() => setAddModalOpen(false)}>
								✕
							</button>
						</div>
						<form onSubmit={handleAddSubmit}>
							<div className={styles.modalBody}>
								{formError && <div className={styles.formError}>{formError}</div>}

								<div className={styles.formField}>
									<label>Course Code <span style={{ color: 'red' }}>*</span></label>
									<input
										type="text"
										placeholder="e.g., CSC 450"
										value={formData.courseCode}
										onChange={(e) => setFormData({ ...formData, courseCode: e.target.value })}
										autoFocus
									/>
									<p className="small">Format: ABC 123 (3 letters, space, 3 digits)</p>
								</div>

								<div className={styles.formField}>
									<label>Course Name <span style={{ color: 'red' }}>*</span></label>
									<input
										type="text"
										placeholder="e.g., Database Management Systems"
										value={formData.courseName}
										onChange={(e) => setFormData({ ...formData, courseName: e.target.value })}
									/>
								</div>

								<div className={styles.formField}>
									<label>Department <span style={{ color: 'red' }}>*</span></label>
									<input
										type="text"
										placeholder="e.g., Computer Science"
										value={formData.department}
										onChange={(e) => setFormData({ ...formData, department: e.target.value })}
									/>
								</div>
							</div>
							<div className={styles.modalFooter}>
								<button
									type="button"
									className="button secondary"
									onClick={() => setAddModalOpen(false)}
									disabled={saving}
								>
									Cancel
								</button>
								<button type="submit" className="button" disabled={saving}>
									{saving ? 'Adding...' : 'Add Course'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{editModalOpen && (
				<div className={styles.modalOverlay} onClick={() => setEditModalOpen(false)}>
					<div className={styles.modal} onClick={(e) => e.stopPropagation()}>
						<div className={styles.modalHeader}>
							<h3>Edit Course</h3>
							<button className={styles.closeButton} onClick={() => setEditModalOpen(false)}>
								✕
							</button>
						</div>
						<form onSubmit={handleEditSubmit}>
							<div className={styles.modalBody}>
								{formError && <div className={styles.formError}>{formError}</div>}

								<div className={styles.formField}>
									<label>Course Code <span style={{ color: 'red' }}>*</span></label>
									<input
										type="text"
										placeholder="e.g., CSC 450"
										value={formData.courseCode}
										onChange={(e) => setFormData({ ...formData, courseCode: e.target.value })}
										autoFocus
									/>
									<p className="small">Format: ABC 123 (3 letters, space, 3 digits)</p>
								</div>

								<div className={styles.formField}>
									<label>Course Name <span style={{ color: 'red' }}>*</span></label>
									<input
										type="text"
										placeholder="e.g., Database Management Systems"
										value={formData.courseName}
										onChange={(e) => setFormData({ ...formData, courseName: e.target.value })}
									/>
								</div>

								<div className={styles.formField}>
									<label>Department <span style={{ color: 'red' }}>*</span></label>
									<input
										type="text"
										placeholder="e.g., Computer Science"
										value={formData.department}
										onChange={(e) => setFormData({ ...formData, department: e.target.value })}
									/>
								</div>
							</div>
							<div className={styles.modalFooter}>
								<button
									type="button"
									className="button secondary"
									onClick={() => setEditModalOpen(false)}
									disabled={saving}
								>
									Cancel
								</button>
								<button type="submit" className="button" disabled={saving}>
									{saving ? 'Updating...' : 'Update Course'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{deleteModalOpen && selectedCourse && (
				<div className={styles.modalOverlay} onClick={() => setDeleteModalOpen(false)}>
					<div className={styles.modalSmall} onClick={(e) => e.stopPropagation()}>
						<div className={styles.modalHeader}>
							<h3>Delete Course</h3>
							<button className={styles.closeButton} onClick={() => setDeleteModalOpen(false)}>
								✕
							</button>
						</div>
						<div className={styles.modalBody}>
							<p>Are you sure you want to delete this course?</p>
							<div className={styles.deleteCourseInfo}>
								<strong>{selectedCourse.courseCode}</strong> - {selectedCourse.courseName}
							</div>
							<p className="small" style={{ color: '#666', marginTop: 8 }}>
								This action cannot be undone.
							</p>
						</div>
						<div className={styles.modalFooter}>
							<button
								type="button"
								className="button secondary"
								onClick={() => setDeleteModalOpen(false)}
								disabled={saving}
							>
								Cancel
							</button>
							<button
								type="button"
								className={styles.deleteConfirmButton}
								onClick={handleDeleteConfirm}
								disabled={saving}
							>
								{saving ? 'Deleting...' : 'Delete'}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
