import { describe, it, expect } from 'vitest';
import { parseAssayData, buildResultsPayload, inferInspectorType } from '../lab-upload-parse';

describe('parseAssayData', () => {
  it('returns null for empty or missing input', () => {
    expect(parseAssayData(null)).toBeNull();
    expect(parseAssayData(undefined)).toBeNull();
    expect(parseAssayData('')).toBeNull();
  });

  it('returns invalid for malformed JSON', () => {
    expect(parseAssayData('{not-json')).toBe('invalid');
    expect(parseAssayData('"just a string"')).toBe('invalid');
    expect(parseAssayData('[1,2,3]')).toBe('invalid');
    expect(parseAssayData('null')).toBe('invalid');
  });

  it('coerces numeric strings to numbers', () => {
    const result = parseAssayData('{"cr2o3_pct":"42.5","fe_pct":24}');
    expect(result).toEqual({ data: { cr2o3_pct: 42.5, fe_pct: 24 } });
  });

  it('drops non-numeric values', () => {
    const result = parseAssayData('{"cr2o3_pct":42,"notes":"good","bad":"abc"}');
    expect(result).toEqual({ data: { cr2o3_pct: 42 } });
  });

  it('drops infinite and NaN values', () => {
    const result = parseAssayData('{"a":42,"b":"Infinity","c":"NaN"}');
    expect(result).toEqual({ data: { a: 42 } });
  });

  it('returns empty data object when all values are invalid', () => {
    const result = parseAssayData('{"x":"abc"}');
    expect(result).toEqual({ data: {} });
  });
});

describe('buildResultsPayload', () => {
  it('includes assay when data has entries', () => {
    const payload = buildResultsPayload({
      inspectorName: 'Jane Doe',
      reportType: 'lab_report',
      assay: { cr2o3_pct: 42 },
    });
    expect(payload).toEqual({
      inspector_name: 'Jane Doe',
      report_type: 'lab_report',
      assay: { cr2o3_pct: 42 },
    });
  });

  it('omits assay key when data is null', () => {
    const payload = buildResultsPayload({
      inspectorName: 'Jane',
      reportType: 'draft_survey',
      assay: null,
    });
    expect(payload).toEqual({ inspector_name: 'Jane', report_type: 'draft_survey' });
    expect('assay' in payload).toBe(false);
  });

  it('omits assay key when data is empty object', () => {
    const payload = buildResultsPayload({
      inspectorName: 'Jane',
      reportType: 'lab_report',
      assay: {},
    });
    expect('assay' in payload).toBe(false);
  });
});

describe('inferInspectorType', () => {
  it('maps draft_survey report to draft_survey', () => {
    expect(inferInspectorType('draft_survey')).toBe('draft_survey');
  });

  it('maps lab_report and assay_certificate to lab_assay', () => {
    expect(inferInspectorType('lab_report')).toBe('lab_assay');
    expect(inferInspectorType('assay_certificate')).toBe('lab_assay');
    expect(inferInspectorType('weighbridge_ticket')).toBe('lab_assay');
  });
});
