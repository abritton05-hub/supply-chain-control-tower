# Brother P-touch Label Export

The app exports a plain CSV that is ready for Brother P-touch Editor database linking.

## Export file

- Filename: `ptouch-label-export.csv`
- MIME type: `text/csv`
- Columns (in order):
  1. `identifier`
  2. `part_number`
  3. `description`
  4. `qty`
  5. `location`
  6. `reference`

## Workflow

1. Export CSV from the app.
2. Open your saved `.lbx` template in Brother P-touch Editor.
3. Link the CSV as the database source.
4. Print labels.

## Label content mapping

- Top (bold): `identifier`
- Middle: `part_number`, `description`, `qty`
- Bottom: `location`, `reference`

No barcode fields are included in this export format.
