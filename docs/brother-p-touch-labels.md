# Brother P-touch Label Export

This first pass does not control Brother P-touch printers directly from the browser.
Instead, the app exports clean label data that can be imported into Brother P-touch
Editor or consumed later by a desktop bridge.

The label utility in `lib/labels/p-touch.ts` generates CSV-ready payloads for:

- inventory item labels
- location and bin labels
- receiving labels
- shipping and manifest labels

Each payload keeps the original CSV fields: part number, item ID, description,
quantity, location/bin, reference, date, barcode text/type metadata, and a
barcode/QR payload string. P-touch Editor can import the CSV and map those
columns onto a saved label template.

The export also includes operational label fields for newer templates:
`identifierTitle`, `mainTitle`, `detailBlock`, `destinationTitle`,
`destinationName`, `contactLine`, `addressLine1`, `addressLine2`,
`cityStateZip`, `labelDate`, `denaliLogo`, and the existing `barcodePayload`.
`detailBlock` is exported with newline-separated human-readable lines only:
`REF:`, `PO:`, `Tracking #:`, and `DATE:`. `barcodePayload` stays available as
its own machine-readable column and should only be mapped to barcode or QR
objects, not visible label text.

Inventory barcode payloads use structured scanner-friendly values like
`SCCT|type=inventory|item_id=...|part_number=...|location=...|bin=...`.
Location labels use `SCCT|type=location|location=...|bin=...`. Template text
objects should use human-readable columns such as `barcodeText`, `partNumber`,
`itemId`, `description`, and `locationBin`; keep `barcodePayload` reserved for
P-touch barcode or QR objects. `barcodeType` defaults to `QR` so P-touch
templates can map `barcodePayload` directly into QR code objects.
