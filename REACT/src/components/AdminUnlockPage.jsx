import React from 'react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FileKey2, ShieldCheck } from 'lucide-react'

function AdminUnlockPage({ grantToken, adminSession, onUnlock, unlocking, errorMessage }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [passphrase, setPassphrase] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()

    if (!selectedFile || !grantToken) {
      return
    }

    const keyFile = await selectedFile.text()
    await onUnlock({
      grantToken,
      keyFile,
      passphrase,
    })
  }

  return (
    <div className="auth-shell">
      <section className="auth-card admin-auth-card">
        <div className="admin-auth-copy">
          <p className="eyebrow">Owner Console</p>
          <h1>Unlock the admin side</h1>
          <p className="lede">
            This console does not use a normal login. Upload your encrypted admin key file and
            enter its passphrase to open the owner-only dashboard.
          </p>
        </div>

        {adminSession ? (
          <section className="admin-panel-callout">
            <div className="admin-inline-icon">
              <ShieldCheck size={20} />
            </div>
            <div>
              <strong>Admin session active</strong>
              <p>You are already unlocked. Jump straight into the owner console.</p>
            </div>
            <Link to="/endmin/dashboard" className="primary">
              Open dashboard
            </Link>
          </section>
        ) : grantToken ? (
          <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
            <label>
              Encrypted key file
              <input
                type="file"
                accept=".json,.key"
                onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              />
            </label>

            <label>
              Passphrase
              <input
                type="password"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                placeholder="Enter the passphrase used to encrypt the key file"
              />
            </label>

            {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

            <div className="campaign-form-actions">
              <button
                type="submit"
                className="primary"
                disabled={unlocking || !selectedFile || passphrase.trim().length < 12}
              >
                {unlocking ? 'Unlocking...' : 'Unlock admin console'}
              </button>
            </div>
          </form>
        ) : (
          <section className="admin-panel-callout">
            <div className="admin-inline-icon">
              <FileKey2 size={20} />
            </div>
            <div>
              <strong>Open the backend gate first</strong>
              <p>
                To reach this upload page securely, visit <code>http://localhost:3000/endmin</code>{' '}
                first. That route issues the short-lived admin grant required for unlock.
              </p>
            </div>
          </section>
        )}
      </section>
    </div>
  )
}

export default AdminUnlockPage
