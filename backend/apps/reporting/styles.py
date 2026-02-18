"""Shared CSS styles for PDF report rendering."""

REPORT_CSS = """
@page {
    size: A4;
    margin: 15mm;
    @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 9pt;
        color: #9ca3af;
    }
}

* {
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 10pt;
    color: #1f2937;
    line-height: 1.4;
    margin: 0;
    padding: 0;
}

.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 8px;
    border-bottom: 1px solid #d1d5db;
    margin-bottom: 16px;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 10px;
}

.logo {
    width: 92px;
    height: auto;
}

.logo-fallback {
    font-size: 14pt;
    font-weight: 700;
    color: #1f5c6a;
    letter-spacing: 0.2px;
}

.project-name {
    font-size: 14pt;
    font-weight: 600;
    color: #1f5c6a;
}

.result-set-name {
    font-size: 10pt;
    color: #6b7280;
}

.section {
    page-break-inside: avoid;
    page-break-after: always;
    margin-bottom: 24px;
}

.section:last-child {
    page-break-after: auto;
}

.section-title {
    font-size: 12pt;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 12px;
    padding-bottom: 4px;
    border-bottom: 1px solid #e5e7eb;
}

.data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8pt;
    margin-bottom: 16px;
}

.data-table th {
    background-color: #f3f4f6;
    font-weight: 600;
    text-align: center;
    padding: 4px 6px;
    border: 1px solid #d1d5db;
}

.data-table th.label-header {
    text-align: left;
    background-color: #e5e7eb;
}

.data-table td {
    text-align: center;
    padding: 3px 6px;
    border: 1px solid #e5e7eb;
}

.data-table td.label-cell {
    text-align: left;
    font-weight: 500;
}

.data-table tr:nth-child(even) td {
    background-color: #f9fafb;
}

.chart-container {
    width: 100%;
    text-align: center;
    margin-top: 12px;
}

.chart-container svg {
    max-width: 100%;
    height: auto;
}

.top10-label {
    font-size: 9pt;
    color: #6b7280;
    margin-bottom: 4px;
    font-style: italic;
}
"""
