export type DeliveryView = 'bom' | 'manifest' | 'pickups' | 'deliveries' | 'history';

export type BomHeader = {
  id: string;
  bom_number: string | null;
  bom_date: string | null;
  status: string | null;
  project_job_number: string | null;
  requested_by: string | null;
};

export type ManifestHeader = {
  id: string;
  manifest_number: string | null;
  document_title: string | null;
  manifest_date: string | null;
  manifest_time: string | null;
  direction: string | null;
  status: string | null;
  shipment_transfer_id: string | null;
  driver_carrier: string | null;
  reference_project_work_order: string | null;
};

export type HistoryRecord = {
  id: string;
  type: 'BOM / Release' | 'Manifest';
  number: string;
  title: string;
  date: string | null;
  status: string;
  direction: string;
  reference: string;
  href: string;
};

export type DeliveryPageData = {
  view: DeliveryView;
  focusedManifestNumber: string;
  focusedManifestDate: string;
  initialManifestHistoryFilter: 'OPEN' | 'COMPLETE' | 'ALL';
  boms: BomHeader[];
  manifests: ManifestHeader[];
  pickups: ManifestHeader[];
  deliveries: ManifestHeader[];
  history: HistoryRecord[];
  bomError: string;
  manifestError: string;
};
