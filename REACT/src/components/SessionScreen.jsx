import React from 'react'
import {
  Backpack,
  Bot,
  BookCopy,
  ChevronsDown,
  Menu,
  Minimize2,
  Volume2,
  X,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  InventoryEditorModal,
  InventoryModal,
} from './feedback'
import CampaignManagerModal from './CampaignManagerModal'
import { formatAiMode, formatAiProvider } from '../utils/campaign'
import { synthesizeCampaignMessageSpeech } from '../services/campaignApi'

function getTargetScrollTop(viewport, target, offset = 12) {
  const viewportRect = viewport.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()

  return Math.max(viewport.scrollTop + (targetRect.top - viewportRect.top) - offset, 0)
}

function SessionScreen({
  user,
  campaign,
  campaigns,
  campaignsLoading,
  campaignManagerOpen,
  campaignDeletingId,
  topbarVisible,
  setTopbarVisible,
  chatViewportRef,
  quickChoices,
  loading,
  draft,
  setDraft,
  inventoryOpen,
  inventoryEditorOpen,
  inventoryForm,
  setInventoryForm,
  editingInventoryId,
  inventorySaving,
  onChooseOption,
  onSendMessage,
  onOpenInventory,
  onCloseInventory,
  onBeginInventoryCreate,
  onBeginInventoryEdit,
  onCloseInventoryEditor,
  onSaveInventoryItem,
  onDeleteInventoryItem,
  onOpenCampaignManager,
  onCloseCampaignManager,
  onOpenCampaign,
  onBeginCampaignCreate,
  onBeginCampaignEdit,
  onDeleteCampaign,
  onScrollChatToBottom,
  onOpenAiInfo,
  onLogout,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isMobileLayout, setIsMobileLayout] = useState(false)
  const latestUserMessageRef = useRef(null)
  const previousAssistantMessageIdRef = useRef(null)
  const scrollTimeoutRef = useRef(null)
  const scrollRetryFrameRef = useRef(null)
  const pendingScrollAssistantIdRef = useRef(null)
  const activeAudioRef = useRef(null)
  const cachedSpeechUrlMapRef = useRef(new Map())
  const pendingSpeechRequestMapRef = useRef(new Map())
  const [activeSpeechMessageId, setActiveSpeechMessageId] = useState(null)
  const [loadingSpeechMessageId, setLoadingSpeechMessageId] = useState(null)

  const latestAssistantMessageId = useMemo(() => {
    if (!campaign?.messages?.length) {
      return null
    }

    const latestAssistantMessage = [...campaign.messages]
      .reverse()
      .find((message) => message.role === 'assistant')

    return latestAssistantMessage?._id || null
  }, [campaign?.messages])

  const latestUserMessageId = useMemo(() => {
    if (!campaign?.messages?.length) {
      return null
    }

    const latestUserMessage = [...campaign.messages]
      .reverse()
      .find((message) => message.role === 'user')

    return latestUserMessage?._id || null
  }, [campaign?.messages])

  const latestAssistantMessage = useMemo(() => {
    if (!campaign?.messages?.length) {
      return null
    }

    return [...campaign.messages]
      .reverse()
      .find((message) => message.role === 'assistant') || null
  }, [campaign?.messages])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 720px)')

    const updateLayout = () => {
      setIsMobileLayout(mediaQuery.matches)
    }

    updateLayout()
    mediaQuery.addEventListener('change', updateLayout)

    return () => mediaQuery.removeEventListener('change', updateLayout)
  }, [])

  useEffect(() => {
    if (!isMobileLayout && mobileMenuOpen) {
      setMobileMenuOpen(false)
    }
  }, [isMobileLayout, mobileMenuOpen])

  useEffect(() => {
    if (!mobileMenuOpen) {
      return undefined
    }

    const originalOverflow = document.body.style.overflow

    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    const cachedSpeechUrls = cachedSpeechUrlMapRef.current
    const pendingSpeechRequests = pendingSpeechRequestMapRef.current

    return () => {
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current)
      }

      if (scrollRetryFrameRef.current) {
        window.cancelAnimationFrame(scrollRetryFrameRef.current)
      }

      if (activeAudioRef.current) {
        activeAudioRef.current.pause()
        activeAudioRef.current = null
      }

      for (const audioUrl of cachedSpeechUrls.values()) {
        URL.revokeObjectURL(audioUrl)
      }

      cachedSpeechUrls.clear()
      pendingSpeechRequests.clear()
    }
  }, [])

  useEffect(() => {
    if (!latestAssistantMessage?._id || !campaign?._id) {
      return
    }

    void prefetchSpeechForMessage(latestAssistantMessage._id)
  }, [campaign?._id, latestAssistantMessage, prefetchSpeechForMessage])

  useEffect(() => {
    if (!latestAssistantMessageId) {
      previousAssistantMessageIdRef.current = null
      pendingScrollAssistantIdRef.current = null
      return
    }

    if (!previousAssistantMessageIdRef.current) {
      previousAssistantMessageIdRef.current = latestAssistantMessageId
      return
    }

    if (previousAssistantMessageIdRef.current === latestAssistantMessageId) {
      return
    }

    previousAssistantMessageIdRef.current = latestAssistantMessageId
    pendingScrollAssistantIdRef.current = latestAssistantMessageId
  }, [latestAssistantMessageId])

  useLayoutEffect(() => {
    if (
      loading ||
      !latestAssistantMessageId ||
      pendingScrollAssistantIdRef.current !== latestAssistantMessageId
    ) {
      return
    }

    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current)
      scrollTimeoutRef.current = null
    }

    if (scrollRetryFrameRef.current) {
      window.cancelAnimationFrame(scrollRetryFrameRef.current)
      scrollRetryFrameRef.current = null
    }

    let attempts = 0

    const tryScroll = () => {
      const viewport = chatViewportRef.current
      const target = latestUserMessageRef.current

      if (!viewport || !target) {
        attempts += 1

        if (attempts < 10) {
          scrollRetryFrameRef.current = window.requestAnimationFrame(tryScroll)
        }
        return
      }

      const targetTop = getTargetScrollTop(viewport, target)

      scrollTimeoutRef.current = window.setTimeout(() => {
        viewport.scrollTo({
          top: targetTop,
          behavior: 'smooth',
        })
        pendingScrollAssistantIdRef.current = null
        scrollTimeoutRef.current = null
      }, 100)
    }

    scrollRetryFrameRef.current = window.requestAnimationFrame(tryScroll)

    return () => {
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current)
        scrollTimeoutRef.current = null
      }

      if (scrollRetryFrameRef.current) {
        window.cancelAnimationFrame(scrollRetryFrameRef.current)
        scrollRetryFrameRef.current = null
      }
    }
  }, [chatViewportRef, latestAssistantMessageId, latestUserMessageId, loading])

  function openMobileMenu() {
    setMobileMenuOpen(true)
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false)
  }

  function handleJumpToBottom() {
    closeMobileMenu()
    onScrollChatToBottom('smooth')
  }

  function handleOpenInventory() {
    closeMobileMenu()
    onOpenInventory()
  }

  function handleOpenCampaignManager() {
    closeMobileMenu()
    onOpenCampaignManager()
  }

  function handleOpenAiInfo() {
    closeMobileMenu()
    onOpenAiInfo()
  }

  function handleHideControls() {
    closeMobileMenu()
    setTopbarVisible(false)
  }

  async function prefetchSpeechForMessage(messageId) {
    const cachedAudioUrl = cachedSpeechUrlMapRef.current.get(messageId)

    if (cachedAudioUrl) {
      return cachedAudioUrl
    }

    const pendingRequest = pendingSpeechRequestMapRef.current.get(messageId)

    if (pendingRequest) {
      return pendingRequest
    }

    const request = synthesizeCampaignMessageSpeech(campaign._id, messageId)
      .then((audioBlob) => {
        const audioUrl = URL.createObjectURL(audioBlob)
        cachedSpeechUrlMapRef.current.set(messageId, audioUrl)
        pendingSpeechRequestMapRef.current.delete(messageId)
        return audioUrl
      })
      .catch((error) => {
        pendingSpeechRequestMapRef.current.delete(messageId)
        throw error
      })

    pendingSpeechRequestMapRef.current.set(messageId, request)

    return request
  }

  async function handleReadOutLoud(message) {
    if (activeSpeechMessageId === message._id) {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause()
        activeAudioRef.current.currentTime = 0
        activeAudioRef.current = null
      }

      setActiveSpeechMessageId(null)
      setLoadingSpeechMessageId(null)
      return
    }

    if (activeAudioRef.current) {
      activeAudioRef.current.pause()
      activeAudioRef.current = null
    }

    setLoadingSpeechMessageId(message._id)

    try {
      const audioUrl = await prefetchSpeechForMessage(message._id)
      const audio = new Audio(audioUrl)

      audio.onended = () => {
        setActiveSpeechMessageId((currentId) => (currentId === message._id ? null : currentId))
        if (activeAudioRef.current === audio) {
          activeAudioRef.current = null
        }
      }

      audio.onerror = () => {
        setActiveSpeechMessageId((currentId) => (currentId === message._id ? null : currentId))
        if (activeAudioRef.current === audio) {
          activeAudioRef.current = null
        }
      }

      activeAudioRef.current = audio
      setActiveSpeechMessageId(message._id)
      await audio.play()
    } catch (error) {
      console.error('Failed to play Dungeon Master voice:', error)
      setActiveSpeechMessageId(null)
    } finally {
      setLoadingSpeechMessageId((currentId) => (currentId === message._id ? null : currentId))
    }
  }

  return (
    <>
      {!topbarVisible ? (
        <button
          type="button"
          className="floating-action topbar-toggle"
          onClick={() => setTopbarVisible(true)}
          aria-label="Show controls"
          title="Show controls"
        >
          <Menu size={20} />
        </button>
      ) : null}

      <main className={`session-stage ${topbarVisible ? 'with-topbar' : 'without-topbar'}`}>
        {topbarVisible ? (
          isMobileLayout ? (
            <header className="story-header fixed mobile-story-header">
              <div className="mobile-story-header-main">
                <div className="mobile-story-copy">
                  <p className="eyebrow">Live session</p>
                  <h2>{campaign.title}</h2>
                </div>
                <button
                  type="button"
                  className="icon-button mobile-menu-trigger"
                  onClick={openMobileMenu}
                  aria-label="Open session menu"
                  title="Session menu"
                >
                  <Menu size={18} />
                </button>
              </div>
              <div className="campaign-actions mobile-campaign-summary">
                <span className="campaign-badge">{user?.name}</span>
                <span className="campaign-badge">{campaign.characterName}</span>
                <span className="campaign-badge">{campaign.tone}</span>
              </div>
            </header>
          ) : (
            <header className="story-header fixed">
              <div>
                <p className="eyebrow">Live session</p>
                <h2>{campaign.title}</h2>
              </div>
              <div className="campaign-actions">
                <span className="campaign-badge">{campaign.characterName}</span>
                <span className="campaign-badge">{campaign.tone}</span>
                <span className="campaign-badge">{user?.name}</span>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => onScrollChatToBottom('smooth')}
                  aria-label="Jump to bottom"
                  title="Jump to bottom"
                >
                  <ChevronsDown size={18} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={onOpenCampaignManager}
                  aria-label="Open campaign vault"
                  title="Campaign vault"
                >
                  <BookCopy size={18} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={onLogout}
                  aria-label="Log out"
                  title="Log out"
                >
                  <X size={18} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setTopbarVisible(false)}
                  aria-label="Hide top bar"
                  title="Hide top bar"
                >
                  <Minimize2 size={18} />
                </button>
              </div>
            </header>
          )
        ) : null}

        <section className="chat-log" ref={chatViewportRef}>
          {campaign.messages.map((message) => (
            <article
              key={message._id}
              ref={
                message._id === latestUserMessageId && message.role === 'user'
                  ? latestUserMessageRef
                  : null
              }
              className={`message ${message.role}`}
            >
              <p className="message-role">
                {message.role === 'assistant' ? 'Dungeon Master' : campaign.characterName}
              </p>
              <p className="message-content">{message.content}</p>
              {message.role === 'assistant' ? (
                <button
                  type="button"
                  className={`ghost message-tts-button ${
                    activeSpeechMessageId === message._id ? 'is-speaking' : ''
                  }`}
                  onClick={() => void handleReadOutLoud(message)}
                  disabled={loadingSpeechMessageId === message._id}
                  aria-label={`Read Dungeon Master message out loud${
                    activeSpeechMessageId === message._id ? ' again to stop playback' : ''
                  }`}
                >
                  <Volume2 size={18} />
                  {loadingSpeechMessageId === message._id
                    ? 'Preparing Voice...'
                    : activeSpeechMessageId === message._id
                      ? 'Stop Reading'
                      : 'Read Out Loud'}
                </button>
              ) : null}
            </article>
          ))}
        </section>

        {quickChoices.length > 0 ? (
          <section className="quick-choices">
            <p className="choice-label">Quick choices</p>
            <div className="choice-grid">
              {quickChoices.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  className="choice-button"
                  disabled={loading}
                  onClick={() => void onChooseOption(choice)}
                >
                  {choice}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <form className="composer" onSubmit={onSendMessage}>
          <textarea
            rows="4"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="What does your character say or do next?"
            disabled={loading}
          />
          <div className="composer-actions">
            <button type="submit" className="primary" disabled={loading || !draft.trim()}>
              {loading ? 'Thinking...' : 'Send action'}
            </button>
          </div>
        </form>
      </main>

      <div className="ai-indicator" aria-label="Current AI details">
        <button type="button" className="ai-indicator-trigger" aria-label="Current AI">
          <Bot size={18} />
        </button>
        <div className="ai-indicator-tooltip">
          <span className="ai-indicator-label">Current AI</span>
          <strong>{formatAiProvider(campaign)}</strong>
          <span className="ai-indicator-model">{campaign.activeAiModel || 'No active model yet'}</span>
          <span className="ai-indicator-mode">{formatAiMode(campaign)}</span>
        </div>
      </div>

      {isMobileLayout && mobileMenuOpen ? (
        <div className="modal-backdrop mobile-menu-backdrop" onClick={closeMobileMenu}>
          <section
            className="modal-panel mobile-menu-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header-shell">
              <div className="modal-header mobile-menu-header">
                <div>
                  <p className="choice-label">Session menu</p>
                  <h3>{campaign.title}</h3>
                </div>
                <button
                  type="button"
                  className="ghost modal-close-button"
                  onClick={closeMobileMenu}
                  aria-label="Close session menu"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="mobile-menu-summary">
              <span className="campaign-badge">{campaign.characterName}</span>
              <span className="campaign-badge">{campaign.tone}</span>
              <span className="campaign-badge">
                {formatAiProvider(campaign)} / {formatAiMode(campaign)}
              </span>
            </div>

            <div className="mobile-menu-actions">
              <button type="button" className="ghost mobile-menu-action" onClick={handleJumpToBottom}>
                <ChevronsDown size={18} />
                Jump to latest
              </button>
              <button
                type="button"
                className="ghost mobile-menu-action"
                onClick={handleOpenInventory}
              >
                <Backpack size={18} />
                Open inventory
              </button>
              <button
                type="button"
                className="ghost mobile-menu-action"
                onClick={handleOpenCampaignManager}
              >
                <BookCopy size={18} />
                Campaign vault
              </button>
              <button type="button" className="ghost mobile-menu-action" onClick={handleOpenAiInfo}>
                <Bot size={18} />
                View AI details
              </button>
              <button type="button" className="ghost mobile-menu-action" onClick={onLogout}>
                <X size={18} />
                Log out
              </button>
              <button type="button" className="ghost mobile-menu-action" onClick={handleHideControls}>
                <Minimize2 size={18} />
                Hide controls
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {!isMobileLayout ? (
        <button
          type="button"
          className="floating-action inventory-fab"
          onClick={onOpenInventory}
          aria-label="Open inventory"
          title="Inventory"
        >
          <Backpack size={20} />
        </button>
      ) : null}

      <InventoryModal
        open={inventoryOpen}
        campaign={campaign}
        inventorySaving={inventorySaving}
        onAddItem={onBeginInventoryCreate}
        onClose={onCloseInventory}
        onEditItem={onBeginInventoryEdit}
        onDeleteItem={onDeleteInventoryItem}
      />

      <InventoryEditorModal
        open={inventoryEditorOpen}
        inventoryForm={inventoryForm}
        setInventoryForm={setInventoryForm}
        editingInventoryId={editingInventoryId}
        inventorySaving={inventorySaving}
        onClose={onCloseInventoryEditor}
        onSubmit={onSaveInventoryItem}
      />

      <CampaignManagerModal
        open={campaignManagerOpen}
        campaign={campaign}
        campaigns={campaigns}
        campaignsLoading={campaignsLoading}
        campaignDeletingId={campaignDeletingId}
        onClose={onCloseCampaignManager}
        onOpenCampaign={onOpenCampaign}
        onBeginCampaignCreate={onBeginCampaignCreate}
        onBeginCampaignEdit={onBeginCampaignEdit}
        onDeleteCampaign={onDeleteCampaign}
      />
    </>
  )
}

export default SessionScreen
