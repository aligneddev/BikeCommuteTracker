import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { ImportRidesPage } from './ImportRidesPage'
import * as importApi from '../../services/import-api'
import type {
  ImportProgressRealtimeHandlers,
  ImportProgressRealtimeSubscription,
} from '../../services/import-progress-realtime'
import * as realtimeApi from '../../services/import-progress-realtime'

const realtimeState = vi.hoisted(() => ({
  handlers: null as ImportProgressRealtimeHandlers | null,
  subscription: {
    stop: vi.fn(async () => {}),
  } as ImportProgressRealtimeSubscription,
}))

vi.mock('../../services/import-api', () => ({
  previewImportCsv: vi.fn(),
  startImportCsv: vi.fn(),
  getImportStatus: vi.fn(),
  cancelImport: vi.fn(),
}))

vi.mock('../../services/import-progress-realtime', () => ({
  subscribeToImportProgress: vi.fn(
    async (_importJobId: number, handlers: ImportProgressRealtimeHandlers) => {
      realtimeState.handlers = handlers
      return realtimeState.subscription
    },
  ),
}))

const mockPreviewImportCsv = vi.mocked(importApi.previewImportCsv)
const mockStartImportCsv = vi.mocked(importApi.startImportCsv)
const mockGetImportStatus = vi.mocked(importApi.getImportStatus)
const mockCancelImport = vi.mocked(importApi.cancelImport)
const mockSubscribeToImportProgress = vi.mocked(realtimeApi.subscribeToImportProgress)

describe('ImportRidesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    realtimeState.handlers = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('applies realtime progress updates to the progress panel', async () => {
    const user = userEvent.setup()
    mockPreviewImportCsv.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        importJobId: 201,
        totalRows: 2,
        validRows: 2,
        invalidRows: 0,
        duplicateRows: 0,
        requiresDuplicateResolution: false,
        rows: [
          {
            rowNumber: 1,
            date: '2026-04-01',
            miles: 12.5,
            rideMinutes: 45,
            temperature: 60,
            tags: 'commute',
            notes: 'morning',
            isValid: true,
            errors: [],
            duplicateMatches: [],
          },
          {
            rowNumber: 2,
            date: '2026-04-02',
            miles: 9.5,
            rideMinutes: 38,
            temperature: 55,
            tags: 'errand',
            notes: 'afternoon',
            isValid: true,
            errors: [],
            duplicateMatches: [],
          },
        ],
      },
    })
    mockStartImportCsv.mockResolvedValue({
      ok: true,
      status: 202,
      data: {
        importJobId: 201,
        status: 'processing',
        startedAtUtc: '2026-04-10T10:10:00Z',
      },
    })
    mockGetImportStatus.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        importJobId: 201,
        status: 'processing',
        totalRows: 2,
        processedRows: 0,
        importedRows: 0,
        skippedRows: 0,
        failedRows: 0,
        percentComplete: 0,
        etaMinutesRounded: null,
        createdAtUtc: '2026-04-10T10:09:00Z',
        startedAtUtc: '2026-04-10T10:10:00Z',
        completedAtUtc: null,
        lastError: null,
      },
    })

    render(
      <BrowserRouter>
        <ImportRidesPage />
      </BrowserRouter>,
    )

    const fileInput = screen.getByLabelText(/select csv file/i) as HTMLInputElement
    const csvFile = new File(['Date,Miles\n2026-04-01,12.5'], 'rides.csv', {
      type: 'text/csv',
    })

    fireEvent.change(fileInput, { target: { files: [csvFile] } })
    fireEvent.click(screen.getByRole('button', { name: /preview import/i }))
    await user.click(await screen.findByRole('button', { name: /start import/i }))

    await waitFor(() => {
      expect(mockSubscribeToImportProgress).toHaveBeenCalledWith(
        201,
        expect.objectContaining({
          onProgress: expect.any(Function),
          onConnectionStateChanged: expect.any(Function),
        }),
      )
    })

    await act(async () => {
      realtimeState.handlers?.onConnectionStateChanged('connected')
      realtimeState.handlers?.onProgress({
        riderId: 42,
        importJobId: 201,
        status: 'processing',
        percentComplete: 50,
        etaMinutesRounded: 5,
        processedRows: 1,
        totalRows: 2,
        importedRows: 1,
        skippedRows: 0,
        failedRows: 0,
        emittedAtUtc: '2026-04-10T10:12:00Z',
      })
    })

    await waitFor(() => {
      expect(screen.getByText(/complete: 50%/i)).toBeInTheDocument()
      expect(screen.getByText(/eta: ~5 minutes remaining/i)).toBeInTheDocument()
      expect(screen.getByText(/imported: 1/i)).toBeInTheDocument()
    })
  })

  it('falls back to polling when SignalR disconnects', async () => {

    mockPreviewImportCsv.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        importJobId: 202,
        totalRows: 1,
        validRows: 1,
        invalidRows: 0,
        duplicateRows: 0,
        requiresDuplicateResolution: false,
        rows: [
          {
            rowNumber: 1,
            date: '2026-04-01',
            miles: 12.5,
            rideMinutes: 45,
            temperature: 60,
            tags: 'commute',
            notes: 'morning',
            isValid: true,
            errors: [],
            duplicateMatches: [],
          },
        ],
      },
    })
    mockStartImportCsv.mockResolvedValue({
      ok: true,
      status: 202,
      data: {
        importJobId: 202,
        status: 'processing',
        startedAtUtc: '2026-04-10T10:20:00Z',
      },
    })
    mockGetImportStatus.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        importJobId: 202,
        status: 'processing',
        totalRows: 1,
        processedRows: 0,
        importedRows: 0,
        skippedRows: 0,
        failedRows: 0,
        percentComplete: 0,
        etaMinutesRounded: null,
        createdAtUtc: '2026-04-10T10:19:00Z',
        startedAtUtc: '2026-04-10T10:20:00Z',
        completedAtUtc: null,
        lastError: null,
      },
    })

    render(
      <BrowserRouter>
        <ImportRidesPage />
      </BrowserRouter>,
    )

    const fileInput = screen.getByLabelText(/select csv file/i) as HTMLInputElement
    const csvFile = new File(['Date,Miles\n2026-04-01,12.5'], 'rides.csv', {
      type: 'text/csv',
    })

    fireEvent.change(fileInput, { target: { files: [csvFile] } })
    fireEvent.click(screen.getByRole('button', { name: /preview import/i }))
    fireEvent.click(await screen.findByRole('button', { name: /start import/i }))

    await waitFor(() => {
      expect(mockSubscribeToImportProgress).toHaveBeenCalledWith(
        202,
        expect.objectContaining({
          onProgress: expect.any(Function),
          onConnectionStateChanged: expect.any(Function),
        }),
      )
    })

    await act(async () => {
      realtimeState.handlers?.onConnectionStateChanged('disconnected')
    })

    const baselineCalls = mockGetImportStatus.mock.calls.length
    await waitFor(
      () => {
        expect(mockGetImportStatus.mock.calls.length).toBeGreaterThan(baselineCalls)
      },
      { timeout: 3000 },
    )
  })

  it('renders preview summary after successful upload preview', async () => {
    mockPreviewImportCsv.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        importJobId: 101,
        totalRows: 2,
        validRows: 1,
        invalidRows: 1,
        duplicateRows: 0,
        requiresDuplicateResolution: false,
        rows: [
          {
            rowNumber: 1,
            date: '2026-04-01',
            miles: 12.5,
            rideMinutes: 45,
            temperature: 60,
            tags: 'commute',
            notes: 'morning',
            isValid: true,
            errors: [],
            duplicateMatches: [],
          },
          {
            rowNumber: 2,
            date: '2026-04-02',
            miles: null,
            rideMinutes: 45,
            temperature: 62,
            tags: 'commute',
            notes: 'bad row',
            isValid: false,
            errors: [
              {
                rowNumber: 2,
                code: 'INVALID_MILES',
                message: 'Miles must be greater than 0 and less than or equal to 200.',
                field: 'Miles',
              },
            ],
            duplicateMatches: [],
          },
        ],
      },
    })

    render(
      <BrowserRouter>
        <ImportRidesPage />
      </BrowserRouter>
    )

    const fileInput = screen.getByLabelText(/select csv file/i) as HTMLInputElement
    const csvFile = new File(['Date,Miles\n2026-04-01,12.5'], 'rides.csv', {
      type: 'text/csv',
    })

    fireEvent.change(fileInput, { target: { files: [csvFile] } })
    fireEvent.click(screen.getByRole('button', { name: /preview import/i }))

    await waitFor(() => {
      expect(screen.getByText(/total rows: 2/i)).toBeInTheDocument()
      expect(screen.getByText(/valid rows: 1/i)).toBeInTheDocument()
      expect(screen.getByText(/invalid rows: 1/i)).toBeInTheDocument()
      expect(screen.getByText(/miles: miles must be greater than 0/i)).toBeInTheDocument()
    })
  })

  it('shows error when selected file is not csv', async () => {
    render(
      <BrowserRouter>
        <ImportRidesPage />
      </BrowserRouter>
    )

    const fileInput = screen.getByLabelText(/select csv file/i) as HTMLInputElement
    const nonCsvFile = new File(['not csv'], 'rides.pdf', { type: 'application/pdf' })

    fireEvent.change(fileInput, { target: { files: [nonCsvFile] } })

    expect(screen.getByRole('alert')).toHaveTextContent('Please upload a .csv file.')
    expect(mockPreviewImportCsv).not.toHaveBeenCalled()
  })

  it('shows error when selected file exceeds 5 mb', async () => {
    render(
      <BrowserRouter>
        <ImportRidesPage />
      </BrowserRouter>
    )

    const fileInput = screen.getByLabelText(/select csv file/i) as HTMLInputElement
    const oversizedPayload = new Uint8Array(5 * 1024 * 1024 + 1)
    const oversizedCsv = new File([oversizedPayload], 'rides.csv', {
      type: 'text/csv',
    })

    fireEvent.change(fileInput, { target: { files: [oversizedCsv] } })

    expect(screen.getByRole('alert')).toHaveTextContent('CSV file must be 5 MB or smaller.')
    expect(mockPreviewImportCsv).not.toHaveBeenCalled()
  })

  it('opens duplicate resolution dialog before starting duplicate imports', async () => {
    mockPreviewImportCsv.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        importJobId: 102,
        totalRows: 1,
        validRows: 1,
        invalidRows: 0,
        duplicateRows: 1,
        requiresDuplicateResolution: true,
        rows: [
          {
            rowNumber: 1,
            date: '2026-04-01',
            miles: 12.5,
            rideMinutes: 45,
            temperature: 60,
            tags: 'commute',
            notes: 'morning',
            isValid: true,
            errors: [],
            duplicateMatches: [
              {
                existingRideId: 7,
                existingRideDate: '2026-04-01',
                existingMiles: 12.5,
              },
            ],
          },
        ],
      },
    })

    render(
      <BrowserRouter>
        <ImportRidesPage />
      </BrowserRouter>
    )

    const fileInput = screen.getByLabelText(/select csv file/i) as HTMLInputElement
    const csvFile = new File(['Date,Miles\n2026-04-01,12.5'], 'rides.csv', {
      type: 'text/csv',
    })

    fireEvent.change(fileInput, { target: { files: [csvFile] } })
    fireEvent.click(screen.getByRole('button', { name: /preview import/i }))

    await screen.findByText(/duplicate rows: 1/i)
    fireEvent.click(screen.getByRole('button', { name: /start import/i }))

    expect(screen.getByRole('dialog', { name: /duplicate resolution/i })).toBeInTheDocument()
    expect(mockStartImportCsv).not.toHaveBeenCalled()
  })

  it('submits keep-existing duplicate resolutions from the dialog', async () => {
    const user = userEvent.setup()
    mockPreviewImportCsv.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        importJobId: 103,
        totalRows: 1,
        validRows: 1,
        invalidRows: 0,
        duplicateRows: 1,
        requiresDuplicateResolution: true,
        rows: [
          {
            rowNumber: 1,
            date: '2026-04-01',
            miles: 12.5,
            rideMinutes: 45,
            temperature: 60,
            tags: 'commute',
            notes: 'morning',
            isValid: true,
            errors: [],
            duplicateMatches: [
              {
                existingRideId: 7,
                existingRideDate: '2026-04-01',
                existingMiles: 12.5,
              },
            ],
          },
        ],
      },
    })
    mockStartImportCsv.mockResolvedValue({
      ok: true,
      status: 202,
      data: {
        importJobId: 103,
        status: 'processing',
        startedAtUtc: '2026-04-08T10:00:00Z',
      },
    })
    mockGetImportStatus.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        importJobId: 103,
        status: 'processing',
        totalRows: 1,
        processedRows: 0,
        importedRows: 0,
        skippedRows: 0,
        failedRows: 0,
        percentComplete: 0,
        etaMinutesRounded: null,
        createdAtUtc: '2026-04-08T09:59:00Z',
        startedAtUtc: '2026-04-08T10:00:00Z',
        completedAtUtc: null,
        lastError: null,
      },
    })

    render(
      <BrowserRouter>
        <ImportRidesPage />
      </BrowserRouter>
    )

    const fileInput = screen.getByLabelText(/select csv file/i) as HTMLInputElement
    const csvFile = new File(['Date,Miles\n2026-04-01,12.5'], 'rides.csv', {
      type: 'text/csv',
    })

    fireEvent.change(fileInput, { target: { files: [csvFile] } })
    fireEvent.click(screen.getByRole('button', { name: /preview import/i }))

    await screen.findByText(/duplicate rows: 1/i)
    await user.click(screen.getByRole('button', { name: /start import/i }))

    const dialog = screen.getByRole('dialog', { name: /duplicate resolution/i })
    await user.click(within(dialog).getByLabelText(/row 1 keep existing/i))
    await user.click(within(dialog).getByRole('button', { name: /start import/i }))

    await waitFor(() => {
      expect(mockStartImportCsv).toHaveBeenCalledWith({
        importJobId: 103,
        overrideAllDuplicates: false,
        resolutions: [{ rowNumber: 1, action: 'keep-existing' }],
      })
      expect(screen.getByText(/status: processing/i)).toBeInTheDocument()
    })
  })

  it('submits override-all without per-row duplicate resolutions', async () => {
    const user = userEvent.setup()
    mockPreviewImportCsv.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        importJobId: 104,
        totalRows: 1,
        validRows: 1,
        invalidRows: 0,
        duplicateRows: 1,
        requiresDuplicateResolution: true,
        rows: [
          {
            rowNumber: 1,
            date: '2026-04-01',
            miles: 12.5,
            rideMinutes: 45,
            temperature: 60,
            tags: 'commute',
            notes: 'morning',
            isValid: true,
            errors: [],
            duplicateMatches: [
              {
                existingRideId: 7,
                existingRideDate: '2026-04-01',
                existingMiles: 12.5,
              },
            ],
          },
        ],
      },
    })
    mockStartImportCsv.mockResolvedValue({
      ok: true,
      status: 202,
      data: {
        importJobId: 104,
        status: 'processing',
        startedAtUtc: '2026-04-08T10:05:00Z',
      },
    })
    mockGetImportStatus.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        importJobId: 104,
        status: 'processing',
        totalRows: 1,
        processedRows: 0,
        importedRows: 0,
        skippedRows: 0,
        failedRows: 0,
        percentComplete: 0,
        etaMinutesRounded: null,
        createdAtUtc: '2026-04-08T10:04:00Z',
        startedAtUtc: '2026-04-08T10:05:00Z',
        completedAtUtc: null,
        lastError: null,
      },
    })

    render(
      <BrowserRouter>
        <ImportRidesPage />
      </BrowserRouter>
    )

    const fileInput = screen.getByLabelText(/select csv file/i) as HTMLInputElement
    const csvFile = new File(['Date,Miles\n2026-04-01,12.5'], 'rides.csv', {
      type: 'text/csv',
    })

    fireEvent.change(fileInput, { target: { files: [csvFile] } })
    fireEvent.click(screen.getByRole('button', { name: /preview import/i }))

    await screen.findByText(/duplicate rows: 1/i)
    await user.click(screen.getByRole('button', { name: /start import/i }))

    const dialog = screen.getByRole('dialog', { name: /duplicate resolution/i })
    await user.click(within(dialog).getByLabelText(/override all duplicates/i))
    await user.click(within(dialog).getByRole('button', { name: /start import/i }))

    await waitFor(() => {
      expect(mockStartImportCsv).toHaveBeenCalledWith({
        importJobId: 104,
        overrideAllDuplicates: true,
        resolutions: [],
      })
    })
  })

  it('renders the progress panel after import starts', async () => {
    const user = userEvent.setup()
    mockPreviewImportCsv.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        importJobId: 105,
        totalRows: 2,
        validRows: 2,
        invalidRows: 0,
        duplicateRows: 0,
        requiresDuplicateResolution: false,
        rows: [
          {
            rowNumber: 1,
            date: '2026-04-01',
            miles: 12.5,
            rideMinutes: 45,
            temperature: 60,
            tags: 'commute',
            notes: 'morning',
            isValid: true,
            errors: [],
            duplicateMatches: [],
          },
          {
            rowNumber: 2,
            date: '2026-04-02',
            miles: 10,
            rideMinutes: 40,
            temperature: 58,
            tags: 'errand',
            notes: 'afternoon',
            isValid: true,
            errors: [],
            duplicateMatches: [],
          },
        ],
      },
    })
    mockStartImportCsv.mockResolvedValue({
      ok: true,
      status: 202,
      data: {
        importJobId: 105,
        status: 'processing',
        startedAtUtc: '2026-04-08T10:10:00Z',
      },
    })
    mockGetImportStatus.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        importJobId: 105,
        status: 'processing',
        totalRows: 2,
        processedRows: 0,
        importedRows: 0,
        skippedRows: 0,
        failedRows: 0,
        percentComplete: 0,
        etaMinutesRounded: null,
        createdAtUtc: '2026-04-08T10:09:00Z',
        startedAtUtc: '2026-04-08T10:10:00Z',
        completedAtUtc: null,
        lastError: null,
      },
    })

    render(
      <BrowserRouter>
        <ImportRidesPage />
      </BrowserRouter>
    )

    const fileInput = screen.getByLabelText(/select csv file/i) as HTMLInputElement
    const csvFile = new File(['Date,Miles\n2026-04-01,12.5'], 'rides.csv', {
      type: 'text/csv',
    })

    fireEvent.change(fileInput, { target: { files: [csvFile] } })
    fireEvent.click(screen.getByRole('button', { name: /preview import/i }))
    await user.click(await screen.findByRole('button', { name: /start import/i }))

    expect(await screen.findByRole('heading', { name: /import progress/i })).toBeInTheDocument()
    expect(screen.getByText(/status: processing/i)).toBeInTheDocument()
    expect(screen.getByText(/complete: 0%/i)).toBeInTheDocument()
  })

  it('cancels an in-progress import from the progress panel', async () => {
    const user = userEvent.setup()
    mockGetImportStatus.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        importJobId: 106,
        status: 'processing',
        totalRows: 20,
        processedRows: 5,
        importedRows: 4,
        skippedRows: 1,
        failedRows: 0,
        percentComplete: 25,
        etaMinutesRounded: 10,
        createdAtUtc: '2026-04-08T10:14:00Z',
        startedAtUtc: '2026-04-08T10:15:00Z',
        completedAtUtc: null,
        lastError: null,
      },
    })
    mockCancelImport.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        importJobId: 106,
        status: 'cancelled',
        processedRows: 5,
        importedRows: 4,
        skippedRows: 1,
        failedRows: 0,
        cancelledAtUtc: '2026-04-08T10:16:00Z',
      },
    })
    sessionStorage.setItem('bike_tracking_active_import_job_id', '106')

    render(
      <BrowserRouter>
        <ImportRidesPage />
      </BrowserRouter>
    )

    await screen.findByText(/status: processing/i)
    await user.click(screen.getByRole('button', { name: /cancel import/i }))

    await waitFor(() => {
      expect(mockCancelImport).toHaveBeenCalledWith(106)
      expect(screen.getByText(/status: cancelled/i)).toBeInTheDocument()
      expect(screen.getByText(/imported: 4/i)).toBeInTheDocument()
    })
  })
})
