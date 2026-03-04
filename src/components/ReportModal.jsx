import { useState, useRef, useCallback } from 'react'
import { message, Spin } from 'antd'
import {
    DownloadOutlined,
    CopyOutlined,
    ShareAltOutlined,
    CloseOutlined,
} from '@ant-design/icons'
import html2canvas from 'html2canvas'
import ReportCard from './ReportCard'

export default function ReportModal({ open, onClose, stats, dateRange, hasEfficiency }) {
    const [imgSrc, setImgSrc] = useState(null)
    const [generating, setGenerating] = useState(false)
    const canvasRef = useRef(null)
    const hiddenRef = useRef(null)

    const generate = useCallback(async () => {
        if (!hiddenRef.current) return
        setGenerating(true)
        try {
            const canvas = await html2canvas(hiddenRef.current, {
                backgroundColor: null,
                scale: 2,
                useCORS: true,
                logging: false,
            })
            canvasRef.current = canvas
            setImgSrc(canvas.toDataURL('image/png'))
        } catch {
            message.error('Failed to generate report')
        } finally {
            setGenerating(false)
        }
    }, [])

    // Generate on open
    const onHiddenReady = useCallback(
        (node) => {
            hiddenRef.current = node
            if (node && open && !imgSrc) {
                // Small delay to ensure fonts are rendered
                setTimeout(generate, 100)
            }
        },
        [open, imgSrc, generate]
    )

    const handleClose = () => {
        setImgSrc(null)
        canvasRef.current = null
        onClose()
    }

    const getBlob = () =>
        new Promise((resolve) =>
            canvasRef.current.toBlob((blob) => resolve(blob), 'image/png')
        )

    const handleSave = async () => {
        const blob = await getBlob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const label = dateRange
            ? `${dateRange[0].format('YYYY-MM-DD')}_${dateRange[1].format('YYYY-MM-DD')}`
            : 'all-time'
        a.download = `evtrax-report-${label}.png`
        a.click()
        URL.revokeObjectURL(url)
        message.success('Report saved')
    }

    const handleCopy = async () => {
        try {
            const blob = await getBlob()
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob }),
            ])
            message.success('Copied to clipboard')
        } catch {
            message.error('Copy not supported in this browser')
        }
    }

    const handleShare = async () => {
        try {
            const blob = await getBlob()
            const file = new File([blob], 'evtrax-report.png', { type: 'image/png' })
            if (navigator.share && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: 'EVTrax Report',
                    files: [file],
                })
            } else {
                // Fallback: save instead
                handleSave()
            }
        } catch (e) {
            if (e.name !== 'AbortError') {
                message.error('Share failed')
            }
        }
    }

    if (!open) return null

    return (
        <div className="report-overlay" onClick={handleClose}>
            <div className="report-modal" onClick={(e) => e.stopPropagation()}>
                {/* Close button */}
                <button className="report-close-btn" onClick={handleClose}>
                    <CloseOutlined />
                </button>

                {/* Hidden render target */}
                <div
                    style={{
                        position: 'absolute',
                        left: -9999,
                        top: 0,
                        pointerEvents: 'none',
                    }}
                >
                    <div ref={onHiddenReady}>
                        <ReportCard
                            stats={stats}
                            dateRange={dateRange}
                            hasEfficiency={hasEfficiency}
                        />
                    </div>
                </div>

                {/* Preview */}
                <div className="report-preview">
                    {generating || !imgSrc ? (
                        <div className="report-loading">
                            <Spin />
                            <span style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 13 }}>
                                Generating report…
                            </span>
                        </div>
                    ) : (
                        <img
                            src={imgSrc}
                            alt="EVTrax Report"
                            className="report-image"
                        />
                    )}
                </div>

                {/* Actions */}
                {imgSrc && (
                    <div className="report-actions">
                        <button className="report-action-btn" onClick={handleSave}>
                            <DownloadOutlined style={{ fontSize: 18 }} />
                            <span>Save</span>
                        </button>
                        <button className="report-action-btn" onClick={handleCopy}>
                            <CopyOutlined style={{ fontSize: 18 }} />
                            <span>Copy</span>
                        </button>
                        <button className="report-action-btn" onClick={handleShare}>
                            <ShareAltOutlined style={{ fontSize: 18 }} />
                            <span>Share</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
