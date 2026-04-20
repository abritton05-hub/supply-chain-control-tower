import * as XLSX from 'xlsx';

export function parseExcelFile(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const result = event.target?.result;

        if (!(result instanceof ArrayBuffer)) {
          reject(new Error('Failed to read Excel file.'));
          return;
        }

        const data = new Uint8Array(result);
        const workbook = XLSX.read(data, { type: 'array' });

        if (!workbook.SheetNames.length) {
          reject(new Error('Excel file has no sheets.'));
          return;
        }

        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];

        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          defval: '',
          header: 1,
          raw: false,
        });

        resolve(rows.map((row) => row.map((cell) => String(cell ?? '').trim())));
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read Excel file.'));
    reader.readAsArrayBuffer(file);
  });
}
