# Requirements Document

## Introduction

This feature adds two capabilities to the Baby Tracker application: (1) the ability to download a CSV report covering feeding, diaper, and sleep data for a selected baby within a configurable timeframe, and (2) sleep tracking functionality to log infant sleep sessions with automatic duration calculation.

## Glossary

- **Report_Service**: The backend module responsible for querying tracking data and generating CSV file content for download.
- **Sleep_Tracker**: The backend module responsible for storing and retrieving infant sleep records.
- **Dashboard_UI**: The frontend React interface where users interact with tracking data, stats, and report downloads.
- **CSV_Generator**: The component within Report_Service that formats queried data rows into RFC 4180-compliant CSV output.
- **Sleep_Record**: A data entry representing one sleep session, containing start time, end time, computed duration, and optional notes.
- **Timeframe_Filter**: A user-selectable period (3 days, 1 week, 2 weeks, 30 days, or all history) that constrains which records appear in the report.

## Requirements

### Requirement 1: Sleep Record Creation

**User Story:** As a parent, I want to log my baby's sleep sessions with start and end times, so that I can monitor sleep patterns over time.

#### Acceptance Criteria

1. WHEN a user submits a sleep record with a valid start time and end time, THE Sleep_Tracker SHALL store the record and return it with an auto-calculated duration in minutes (rounded down to the nearest whole number).
2. WHEN a user submits a sleep record where the end time is earlier than or equal to the start time, THE Sleep_Tracker SHALL reject the record and return a validation error indicating the end time must be after the start time.
3. WHEN a user submits a sleep record with notes, THE Sleep_Tracker SHALL store the notes (up to 500 characters) alongside the sleep session data.
4. WHEN a user submits a sleep record without an end time, THE Sleep_Tracker SHALL store the record with a null end time and null duration to represent an ongoing sleep session.
5. THE Sleep_Tracker SHALL associate each sleep record with the authenticated user and the specified baby profile.
6. IF a user submits a sleep record referencing a baby profile that does not exist or does not belong to the authenticated user, THEN THE Sleep_Tracker SHALL reject the request and return an error indicating the baby profile was not found.
7. WHEN a user submits a sleep record with a duration exceeding 1440 minutes (24 hours), THE Sleep_Tracker SHALL reject the record and return a validation error indicating the sleep session duration exceeds the maximum allowed.

### Requirement 2: Sleep Record Retrieval

**User Story:** As a parent, I want to view recent sleep records for my baby, so that I can review sleep history at a glance.

#### Acceptance Criteria

1. WHEN a user requests sleep records for a baby, THE Sleep_Tracker SHALL return records sorted by start time in descending order (most recent first), limited to 50 records by default.
2. THE Sleep_Tracker SHALL return only sleep records belonging to the authenticated user's baby profile.
3. IF a user requests sleep records for a baby that does not belong to them, THEN THE Sleep_Tracker SHALL return a 404 error.

### Requirement 3: Sleep Record Deletion

**User Story:** As a parent, I want to delete incorrect sleep entries, so that my tracking data stays accurate.

#### Acceptance Criteria

1. WHEN a user requests deletion of a sleep record they own, THE Sleep_Tracker SHALL permanently remove the record from the system and return a confirmation response indicating successful deletion.
2. IF a user requests deletion of a sleep record that does not exist or does not belong to them, THEN THE Sleep_Tracker SHALL return a not-found error without revealing whether the record exists for another user.
3. IF a system error occurs during sleep record deletion, THEN THE Sleep_Tracker SHALL return an error response indicating the failure and SHALL NOT remove the record.

### Requirement 4: Sleep Stats on Dashboard

**User Story:** As a parent, I want to see sleep statistics on my dashboard, so that I can understand my baby's sleep averages alongside feeding and diaper data.

#### Acceptance Criteria

1. WHEN the Dashboard_UI displays stats for a selected period, THE Dashboard_UI SHALL show average sleep duration per day in minutes (rounded to 1 decimal place) and total number of sleep sessions for that period, using the same period filter options available for feeding and diaper stats.
2. WHEN the Dashboard_UI displays the daily breakdown, THE Dashboard_UI SHALL include a sleep section showing session count and total sleep minutes for each day within the selected period, in descending date order.
3. IF no sleep records exist for the selected period, THEN THE Dashboard_UI SHALL display 0 for average sleep duration, 0 for total sleep sessions, and omit the daily sleep breakdown table.
4. IF the sleep stats request fails, THEN THE Dashboard_UI SHALL display an error message indicating the stats could not be loaded, without affecting the display of previously loaded feeding or diaper stats.

### Requirement 5: CSV Report Generation

**User Story:** As a parent, I want to download a CSV report of all tracking data for a selected timeframe, so that I can share it with my pediatrician or keep records offline.

#### Acceptance Criteria

1. WHEN a user requests a report with a timeframe filter (3 days, 7 days, 14 days, or 30 days), THE Report_Service SHALL include only records with timestamps within that number of days prior to the current server time in the generated CSV.
2. WHEN a user requests a report without a timeframe filter, THE Report_Service SHALL include all historical records for the selected baby.
3. THE Report_Service SHALL generate a single CSV file containing separate sections for feedings, diapers, and sleep records, where each section begins with a section header row (e.g., "Section: Feedings"), followed by a column header row listing all fields for that record type, followed by the data rows sorted by timestamp in descending order, with sections separated by one empty row.
4. THE CSV_Generator SHALL produce output conforming to RFC 4180 (proper quoting of fields containing commas, newlines, or double quotes).
5. WHEN the Report_Service generates a CSV file, THE Report_Service SHALL set the HTTP response Content-Type header to "text/csv" and Content-Disposition header to trigger a file download with a filename in the format "{baby_name}_{start_date}_{end_date}.csv" where dates are in ISO 8601 date format (YYYY-MM-DD).
6. THE Report_Service SHALL only include records belonging to the authenticated user's baby profile.
7. IF a user requests a report for a baby that does not belong to them, THEN THE Report_Service SHALL return a 404 error.
8. IF no records exist within the requested timeframe for the selected baby, THEN THE Report_Service SHALL return a CSV file containing only the section headers and column headers with no data rows.

### Requirement 6: Report Download UI

**User Story:** As a parent, I want a download button on my dashboard that lets me choose a timeframe and download the report, so that exporting data is quick and intuitive.

#### Acceptance Criteria

1. WHEN the user is on the Dashboard stats tab, THE Dashboard_UI SHALL display a download report button that initiates a CSV file download when activated.
2. WHEN the user clicks the download button, THE Dashboard_UI SHALL use the currently selected period filter (3 days, 7 days, 14 days, or 30 days) as the timeframe for the report.
3. IF no period filter is selected and the user clicks the download button, THEN THE Dashboard_UI SHALL request the report without a timeframe parameter to download the full history.
4. WHILE a report download is in progress, THE Dashboard_UI SHALL display a loading indicator on the download button and disable repeated clicks until the download completes or fails, up to a maximum of 30 seconds.
5. IF the report download fails or the 30-second timeout elapses, THEN THE Dashboard_UI SHALL display an error message indicating the download failed, re-enable the download button, and keep the error message visible until the user dismisses it or initiates a new download.

### Requirement 7: Sleep Tracking UI

**User Story:** As a parent, I want a dedicated Sleep tab on the dashboard, so that I can log and view sleep sessions alongside feedings and diapers.

#### Acceptance Criteria

1. THE Dashboard_UI SHALL display a Sleep tab in the tab navigation alongside Feeding, Diaper, and Dashboard tabs.
2. WHEN the user navigates to the Sleep tab, THE Dashboard_UI SHALL display a form to log a new sleep session with fields for start time (required), end time (optional), and notes (optional, maximum 500 characters).
3. WHEN the user navigates to the Sleep tab, THE Dashboard_UI SHALL display a list of the 20 most recent sleep records for the selected baby, ordered by start time descending, showing start time, end time, duration in hours and minutes (e.g., "2h 15m"), and notes.
4. IF a sleep record has no end time, THEN THE Dashboard_UI SHALL display the record with an "In Progress" indicator and a control to end the session by setting the current time as end time.
5. WHEN the user ends an in-progress sleep session, THE Dashboard_UI SHALL update the record with the end time and display the calculated duration in hours and minutes.
6. IF the user submits a sleep session where end time is earlier than or equal to start time, THEN THE Dashboard_UI SHALL prevent submission and display an error message indicating that end time must be after start time.
