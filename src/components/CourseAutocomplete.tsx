import { useState, useEffect, useRef } from 'react';
import { searchCourses } from '../services/api';
import { Course } from '../types';
import styles from './CourseAutocomplete.module.css';

interface CourseAutocompleteProps {
    value: Course | null;
    onChange: (course: Course | null) => void;
    onAddNew?: (searchTerm: string) => void;
    placeholder?: string;
}

export default function CourseAutocomplete({
    value,
    onChange,
    onAddNew,
    placeholder = "Search courses..."
}: CourseAutocompleteProps) {
    const [inputValue, setInputValue] = useState('');
    const [suggestions, setSuggestions] = useState<Course[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (value) {
            setInputValue(`${value.courseCode} - ${value.courseName}`);
        } else {
            setInputValue('');
        }
    }, [value]);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (inputValue.trim().length > 0 && isOpen) {
                setLoading(true);
                const response = await searchCourses(inputValue.trim());
                if (response.success && response.data) {
                    setSuggestions(response.data);
                } else {
                    setSuggestions([]);
                }
                setLoading(false);
            } else {
                setSuggestions([]);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [inputValue, isOpen]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
        setIsOpen(true);
        setSelectedIndex(-1);
        if (value) {
            onChange(null);
        }
    };

    const handleSelectCourse = (course: Course) => {
        onChange(course);
        setInputValue(`${course.courseCode} - ${course.courseName}`);
        setIsOpen(false);
        setSuggestions([]);
    };

    const handleAddNew = () => {
        setIsOpen(false);
        if (onAddNew) {
            onAddNew(inputValue.trim());
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) {
            if (e.key === 'ArrowDown') {
                setIsOpen(true);
            }
            return;
        }

        const totalItems = suggestions.length + (suggestions.length === 0 && inputValue.trim() ? 1 : 0);

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => (prev < totalItems - 1 ? prev + 1 : prev));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
                    handleSelectCourse(suggestions[selectedIndex]);
                } else if (selectedIndex === suggestions.length && onAddNew) {
                    handleAddNew();
                }
                break;
            case 'Escape':
                setIsOpen(false);
                break;
        }
    };

    const handleFocus = () => {
        setIsOpen(true);
    };

    return (
        <div className={styles.wrapper} ref={wrapperRef}>
            <input
                ref={inputRef}
                type="text"
                className={styles.input}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                placeholder={placeholder}
            />

            {isOpen && (
                <div className={styles.dropdown}>
                    {loading ? (
                        <div className={styles.loading}>Searching...</div>
                    ) : suggestions.length > 0 ? (
                        <>
                            {suggestions.map((course, index) => (
                                <div
                                    key={course._id}
                                    className={`${styles.item} ${index === selectedIndex ? styles.selected : ''}`}
                                    onClick={() => handleSelectCourse(course)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                >
                                    <div className={styles.courseCode}>{course.courseCode}</div>
                                    <div className={styles.courseName}>{course.courseName}</div>
                                    <div className={styles.department}>{course.department}</div>
                                </div>
                            ))}
                        </>
                    ) : inputValue.trim() ? (
                        <div className={styles.emptyState}>
                            <div className={styles.noResults}>
                                🔍 No courses found for "{inputValue}"
                            </div>
                            {onAddNew && (
                                <button
                                    className={`${styles.addNewButton} ${selectedIndex === suggestions.length ? styles.selected : ''}`}
                                    onClick={handleAddNew}
                                    onMouseEnter={() => setSelectedIndex(suggestions.length)}
                                >
                                    ➕ Add "{inputValue}" as New Course
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className={styles.placeholder}>Start typing to search courses...</div>
                    )}
                </div>
            )}
        </div>
    );
}
 