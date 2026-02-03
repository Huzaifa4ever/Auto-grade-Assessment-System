import React, { useState, useEffect } from 'react';
import { Course } from '../types';
import { getCourses, createCourse, updateCourse, deleteCourse } from '../services/api';
import styles from './Settings.module.css';

export default function Settings() {
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

	useEffect(() => {
		loadCourses();
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
				<p>Configure system settings and manage courses</p>
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
