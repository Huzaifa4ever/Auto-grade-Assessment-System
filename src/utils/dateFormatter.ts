/**
 * @param dateString 
 * @returns 
 */
export function formatDateToDDMMYYYY(dateString: string): string {
    if (!dateString) return '';

    try {
        const date = new Date(dateString);

        if (isNaN(date.getTime())) {
            return dateString;
        }

        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();

        return `${day}/${month}/${year}`;
    } catch (error) {
        return dateString;
    }
}

/**
 * @param ddmmyyyy 
 * @returns 
 */
export function convertToInputDate(ddmmyyyy: string): string {
    if (!ddmmyyyy) return '';

    if (ddmmyyyy.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return ddmmyyyy;
    }
    const parts = ddmmyyyy.split('/');
    if (parts.length === 3) {
        const [day, month, year] = parts;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return ddmmyyyy;
}

/**
 * @param yyyymmdd 
 * @returns 
 */
export function convertFromInputDate(yyyymmdd: string): string {
    if (!yyyymmdd) return '';

    if (yyyymmdd.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        return yyyymmdd;
    }
    const parts = yyyymmdd.split('-');
    if (parts.length === 3) {
        const [year, month, day] = parts;
        return `${day}/${month}/${year}`;
    }

    return yyyymmdd;
}
