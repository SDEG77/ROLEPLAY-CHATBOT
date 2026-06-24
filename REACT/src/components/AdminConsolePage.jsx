import React from 'react'
import { useCallback, useEffect, useState } from 'react'
import { Activity, ShieldCheck, Users } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { fetchAdminMetrics, fetchAdminUsers, logoutAdminSession } from '../services/adminApi'

function AdminConsolePage({ adminSession, view, onAdminLogout }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [metrics, setMetrics] = useState(null)
  const [usersData, setUsersData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const loadViewData = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')

    try {
      if (view === 'users') {
        const data = await fetchAdminUsers()
        setUsersData(data)
      } else {
        const data = await fetchAdminMetrics()
        setMetrics(data)
      }
    } catch (error) {
      if (error.status === 401) {
        onAdminLogout()
        navigate('/endmin', { replace: true })
        return
      }

      setErrorMessage(error.message || 'Failed to load admin data.')
    } finally {
      setLoading(false)
    }
  }, [navigate, onAdminLogout, view])

  useEffect(() => {
    void loadViewData()
  }, [loadViewData])

  async function handleLogout() {
    try {
      await logoutAdminSession()
    } finally {
      onAdminLogout()
      navigate('/endmin', { replace: true })
    }
  }

  return (
    <div className="landing-shell admin-shell">
      <header className="landing-nav admin-nav">
        <div>
          <p className="eyebrow">Owner Console</p>
          <h1>Admin side</h1>
          <p className="lede">
            Signed in as {adminSession?.label || 'Owner'} via encrypted key authentication.
          </p>
        </div>
        <div className="landing-nav-actions">
          <Link
            to="/endmin/dashboard"
            className={`ghost inline-link-button ${location.pathname.endsWith('/dashboard') ? 'admin-tab-active' : ''}`}
          >
            <Activity size={18} />
            Dashboard
          </Link>
          <Link
            to="/endmin/users"
            className={`ghost inline-link-button ${location.pathname.endsWith('/users') ? 'admin-tab-active' : ''}`}
          >
            <Users size={18} />
            User accounts
          </Link>
          <button type="button" className="primary" onClick={() => void handleLogout()}>
            Log out admin
          </button>
        </div>
      </header>

      {loading ? (
        <section className="landing-copy admin-panel">
          <p className="eyebrow">Loading</p>
          <h2>Preparing admin data</h2>
          <p className="lede">Fetching the latest metrics from your app.</p>
        </section>
      ) : errorMessage ? (
        <section className="landing-copy admin-panel">
          <p className="eyebrow">Error</p>
          <h2>Admin data could not be loaded</h2>
          <p className="form-error">{errorMessage}</p>
          <div className="campaign-form-actions">
            <button type="button" className="primary" onClick={() => void loadViewData()}>
              Retry
            </button>
          </div>
        </section>
      ) : view === 'users' ? (
        <AdminUsersView usersData={usersData} />
      ) : (
        <AdminDashboardView metrics={metrics} />
      )}
    </div>
  )
}

function AdminDashboardView({ metrics }) {
  return (
    <>
      <section className="landing-stat-strip admin-stat-strip">
        <div>
          <span>Total users</span>
          <strong>{metrics?.totals?.users ?? 0}</strong>
        </div>
        <div>
          <span>Total campaigns</span>
          <strong>{metrics?.totals?.campaigns ?? 0}</strong>
        </div>
        <div>
          <span>Total messages</span>
          <strong>{metrics?.totals?.messages ?? 0}</strong>
        </div>
      </section>

      <section className="feature-grid admin-metric-grid">
        <article className="feature-card admin-panel">
          <div className="feature-icon">
            <Users size={20} />
          </div>
          <h3>Account growth</h3>
          <p>{metrics?.recent?.usersLast7Days ?? 0} new users in the last 7 days.</p>
          <p>{metrics?.recent?.usersLast30Days ?? 0} new users in the last 30 days.</p>
        </article>

        <article className="feature-card admin-panel">
          <div className="feature-icon">
            <Activity size={20} />
          </div>
          <h3>Campaign activity</h3>
          <p>{metrics?.recent?.campaignsLast7Days ?? 0} campaigns created in the last 7 days.</p>
          <p>{metrics?.recent?.campaignsLast30Days ?? 0} campaigns created in the last 30 days.</p>
        </article>
      </section>

      <section className="landing-footer-card admin-lists">
        <div className="landing-footer-copy">
          <p className="eyebrow">Latest users</p>
          {metrics?.latest?.users?.map((user) => (
            <p key={`${user.email}-${user.createdAt}`} className="landing-promise-list-item">
              <strong>{user.name}</strong>
              <br />
              {user.email}
            </p>
          ))}
        </div>
        <div className="landing-footer-copy">
          <p className="eyebrow">Latest campaigns</p>
          {metrics?.latest?.campaigns?.map((campaign) => (
            <p key={`${campaign.title}-${campaign.createdAt}`} className="landing-promise-list-item">
              <strong>{campaign.title}</strong>
              <br />
              {campaign.characterName}
            </p>
          ))}
        </div>
      </section>
    </>
  )
}

function AdminUsersView({ usersData }) {
  return (
    <>
      <section className="landing-stat-strip admin-stat-strip">
        <div>
          <span>Total accounts</span>
          <strong>{usersData?.totalUsers ?? 0}</strong>
        </div>
        <div>
          <span>Visible fields</span>
          <strong>Name and email</strong>
        </div>
        <div>
          <span>Access model</span>
          <strong>Encrypted owner key</strong>
        </div>
      </section>

      <section className="campaign-library admin-users-panel">
        <div className="campaign-library-header">
          <div>
            <p className="eyebrow">User accounts</p>
            <h2>Registered accounts</h2>
          </div>
          <div className="campaign-badge">
            <ShieldCheck size={16} />
            {usersData?.totalUsers ?? 0} total
          </div>
        </div>

        <div className="campaign-library-list">
          {usersData?.users?.map((user) => (
            <article key={user._id} className="campaign-card">
              <div className="campaign-card-copy">
                <strong>{user.name}</strong>
                <p className="campaign-card-meta">{user.email}</p>
                <p className="campaign-card-meta">
                  Created {new Date(user.createdAt).toLocaleString()}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}

export default AdminConsolePage
