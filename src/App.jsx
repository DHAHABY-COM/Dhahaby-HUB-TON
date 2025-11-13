import React, { useEffect, useState } from 'react'
import WebApp from '@twa-dev/sdk'
import { TonConnectButton, useTonAddress, useTonConnectUI } from '@tonconnect/ui-react'
import UploadSection from './components/UploadSection'
import LoansSection from './components/LoansSection'
import { TonClient, Address, beginCell, toNano } from '@ton/ton'
import { storeCreateValuation } from './components/DhahabyValuation_DhahabyValuation.js'
import {trackEvent} from "./utility/trackEvent.js";
const client = new TonClient({
  endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC'
})

export default function App() {
  const [showIntro, setShowIntro] = useState(true)
  const [user, setUser] = useState(null)
  const [theme, setTheme] = useState(WebApp.themeParams)
  const userAddress = useTonAddress()
  const [tc] = useTonConnectUI()
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [telegramUser, setTelegramUser] = useState(null)
  const CONTRACT_ADDRESS = Address.parse('kQANNXMIQF5AOcwtizJG2gJghLU5Bi4A7HLaUoKSu274Wgtu')

  const handleCreateValuation = async () => {
    if (!userAddress) {
      console.error('Wallet not connected')
      return
    }
    try {
      // Example data (replace with real user/store/id if needed)
      const id = 5
      const user = userAddress
      const store = userAddress // For MVP use self
      const msg = {
        $$type: 'CreateValuation',
        query_id: 0n,
        id: BigInt(id),
        user: Address.parse(user),
        store: Address.parse(store),
        valuationHash: 'hash_idxxxx'
      }

      // Build message body
      const messageBody = beginCell().store(storeCreateValuation(msg)).endCell()

      // Prepare transaction
      await tc.sendTransaction({
        validUntil: Date.now() + 5 * 60 * 1000, // 5 minutes
        messages: [
          {
            address: CONTRACT_ADDRESS.toString(),
            amount: toNano('0.05').toString(), // adjust TON amount as needed
            payload: messageBody.toBoc().toString('base64')
          }
        ]
      })
      console.log('Valuation creation transaction sent')
      fetchBalance()
    } catch (err) {
      console.error('Error creating valuation:', err)
    }
  }

  useEffect(() => {
    trackEvent("app_opened");
  }, []);

  tc.onStatusChange((walletInfo) => {
    if (walletInfo) {
      trackEvent("wallet_connected", { wallet_address: walletInfo.account.address });
    }
  });

  const fetchBalance = async () => {
    if (!userAddress) return
    try {

      const balanceNano = await client.getBalance(Address.parse(userAddress))
      setBalance(Number(balanceNano) / 1e9) // convert nanoTON → TON
    } catch (err) {
      console.error('Error fetching balance:', err)
    }
  }

  useEffect(() => {
    fetchBalance()
  }, [userAddress])

  useEffect(() => {
    const unsubscribe = tc.onStatusChange((walletInfo) => {
      if (!walletInfo) {
        // user disconnected the wallet
        setBalance(null)
      } else {
        // user connected a wallet — fetch balance again
        fetchBalance()
      }
    })

    return () => unsubscribe()
  }, [tc])


  useEffect(() => {
    setLoading(true)
    WebApp.ready()
    WebApp.expand()
    setUser(WebApp.initDataUnsafe?.user || null)
    // Find the telegram user by id though api call to https://dhahaby-api.topy.ai/api/user/{telegram_id}
    // Only create if have user information
    if (WebApp.initDataUnsafe?.user?.id) {
      try {
        fetch(`https://dhahaby-api.topy.ai/api/user/${WebApp.initDataUnsafe?.user?.id}`)
          .then(res => res.json())
          .then(data => {
            // If error, create new user via POST to https://dhahaby-api.topy.ai/api/user/create with const { telegramId, fullName } = req.body;
            // 404 means user not found
            if (data.error) {
              console.log('User not found, creating new user...')
              fetch('https://dhahaby-api.topy.ai/api/user/create', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  telegramId: WebApp.initDataUnsafe?.user?.id,
                  fullName: `${WebApp.initDataUnsafe?.user?.first_name || ''} ${WebApp.initDataUnsafe?.user?.last_name || ''}`.trim()
                })
              })
                .then(res => res.json())
                .then(createData => {
                  console.log('User created:', createData)
                  setTelegramUser({
                    id: createData.user_id,
                    wallet_address: null,
                    telegram_id: WebApp.initDataUnsafe?.user?.id,
                    full_name: `${WebApp.initDataUnsafe?.user?.first_name || ''} ${WebApp.initDataUnsafe?.user?.last_name || ''}`.trim(),
                    role: 'customer',
                    created_at: new Date().toISOString(),
                    intro: 1
                  })
                })
                .catch(err => console.error('Error creating user:', err))
              setShowIntro(true)
            }
            setTelegramUser(data.user)
            if (data.user?.intro === true || data.user?.intro === 1) {
              setShowIntro(true)
            }
            console.log('Fetched telegram user:', data.user)
          })
      } catch (err) {
        console.error('Error fetching telegram user:', err)
      }
    }
    const onTheme = () => setTheme(WebApp.themeParams)
    WebApp.onEvent('themeChanged', onTheme)
    setLoading(false)
    return () => WebApp.offEvent('themeChanged', onTheme)
  }, [])

  const onEstimate = async () => {
    WebApp.HapticFeedback.impactOccurred('medium')
    WebApp.showPopup({
      title: 'AI Pre-Valuation',
      message: 'We would send your image to our server for an instant estimate.',
      buttons: [{ id: 'ok', type: 'default', text: 'OK' }]
    })
  }

  const handleCloseIntro = async () => {
    setShowIntro(false)
    if (telegramUser?.telegram_id) {
      // update intro flag to false (0)
      try {
        await fetch(`https://dhahaby-api.topy.ai/api/user/${telegramUser.telegram_id}/intro`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intro: 0 })
        })
      } catch (e) {
        console.error('Failed to update intro flag:', e)
      }
    }
  }

  const [activeTab, setActiveTab] = useState('valuation');

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-4 py-18 w-full">
      {/* INTRO MODAL */}
      {/* Conditionally render the modal */}
      {showIntro && (
        // Modal centered container
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50 bg-opacity-90 p-4">

          {/* Main Modal Card - Rounded, shadowed, and max width */}
          <div
            className="bg-white rounded-[1rem] shadow-2xl shadow-gray-300 max-w-sm w-full p-4 sm:p-8 text-center transition-all duration-300">
            {/* Header Section */}
            <h2 className="text-2xl font-bold text-gray-900 mt-4 mb-0">Welcome to Dhahaby</h2>
            <h3 className="text-base text-gray-700 mb-0">Your Gold, Reimagined</h3>
            <p className="text-gray-600 text-sm mb-4 px-2">
              Turn your gold or jewellery into a verified digital asset you can reuse anytime — for loans, credit, or
              payments.
            </p>

            {/* How It Works Section Container */}
            <div className="p-1 pt-3 rounded-xl border border-gray-100" style={{backgroundColor: '#FFFAEE'}}>
              {/* "Here's how it works" Pill - Gold background, centered on top */}
              <div className="flex justify-center pb-3">
                  <span
                    className="text-white font-semibold text-sm py-2 px-6 rounded-full shadow-lg shadow-amber-300/50"
                    style={{backgroundColor: '#E4A824'}}
                  >
                      Here's how it works
                  </span>
              </div>

              {/* Steps List Container - Relative parent for absolute positioning of lines/circles */}
              <div className="relative text-left space-y-6 px-2">

                {/* Vertical Dashed Line (simulated with absolute position) */}
                <div
                  className="absolute left-6 top-0 bottom-[3.5rem] w-0.5 border-l-2 border-dashed border-amber-300 opacity-70"></div>

                {/* Step 1 */}
                <div className="flex items-start">
                  {/* Number Circle 1 */}
                  <div
                    className="relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold mr-4 shadow-md"
                    style={{backgroundColor: '#E4A824'}}>
                    1
                  </div>
                  <div className="ml-2 pt-1">
                    <p className="font-bold text-gray-800">Add your items</p>
                    <p className="text-sm text-gray-600">
                      upload photos or details of your gold/jewellery.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start">
                  {/* Number Circle 2 */}
                  <div
                    className="relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold mr-4 shadow-md"
                    style={{backgroundColor: '#E4A824'}}>
                    2
                  </div>
                  <div className="ml-2 pt-1">
                    <p className="font-bold text-gray-800">Tokenise & Verify</p>
                    <p className="text-sm text-gray-600">
                      create your digital record & let our jewellers confirm authenticity.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start">
                  {/* Number Circle 3 */}
                  <div
                    className="relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold mr-4 shadow-md"
                    style={{backgroundColor: '#E4A824'}}>
                    3
                  </div>
                  <div className="ml-2 pt-1">
                    <p className="font-bold text-gray-800">Unlock value anytime</p>
                    <p className="text-sm text-gray-600">
                      when you're ready, use your verified asset to access cash or credit through licensed partners.
                    </p>
                  </div>
                </div>

                {/* Bottom Text */}
                <p className="text-sm font-semibold text-gray-700 text-center pb-3">
                  Tokenise once. Unlock forever.
                </p>
              </div>

            </div>
            {/* End How It Works Section Container */}

            {/* Footer Text and Button */}
            <div className="mt-3">
              <p className="text-gray-700 text-sm font-medium mb-3">
                Ready to begin? Tap below to get your first valuation.
              </p>
              <div className="flex justify-center pb-3 w-full">
                <button
                  onClick={handleCloseIntro}
                  className="w-full text-white font-semibold py-2 px-4 shadow-md transition-colors"
                  style={{
                    backgroundColor: '#E4A824',
                    borderRadius: '99px'
                  }}
                >
                  Start Now
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Menu */}
      <div className="fixed top-0 left-0 right-0 z-49 flex justify-center px-4 pt-2 pb-3">
        <div className="w-full max-w-md">
          <div className="flex justify-around bg-white dark:bg-gray-800 rounded-xl shadow-sm p-1 gap-2">
            <button
              className="flex-1 py-2 text-sm font-semibold rounded-lg border-0 focus:outline-none"
              onClick={() => setActiveTab('valuation')}
              style={{
                backgroundColor: activeTab === 'valuation' ? '#E4A824' : 'transparent',
                color: activeTab === 'valuation' ? '#FFFFFF' : (theme?.text_color || '#000000'),
                border: activeTab === 'valuation' ? '1px solid #E4A824' : '1px solid transparent',
              }}
            >
              Valuation
            </button>

            <button
              className="flex-1 py-2 text-sm font-semibold rounded-lg border-0 focus:outline-none"
              onClick={() => setActiveTab('assets')}
              style={{
                backgroundColor: activeTab === 'assets' ? '#E4A824' : 'transparent',
                color: activeTab === 'assets' ? '#FFFFFF' : (theme?.text_color || '#000000'),
                border: activeTab === 'assets' ? '1px solid #E4A824' : '1px solid transparent',
              }}
            >
              My Assets
            </button>
          </div>
        </div>
      </div>
      {/* Content Area */}
      <div className="w-full max-w-md mx-auto mt-3">
        {activeTab === 'valuation' && <UploadSection setActiveTab={setActiveTab}/>}
        {activeTab === 'assets' && <>
          <LoansSection walletAddress={userAddress} setActiveTab={setActiveTab}/>
          {/* User Greeting */}
          <div
            className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3 mb-4 flex items-center justify-between">
            {/* LEFT — Avatar + Name */}
            <div className="flex items-center gap-3">
              <img
                src={user?.photo_url || '/logo.png'}
                alt="User Avatar"
                className="w-10 h-10 rounded-full border border-gray-300 dark:border-gray-600 object-cover"
              />
              <div className="flex flex-col leading-tight">
                {balance !== null ? (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    {balance.toFixed(3)} TON
                  </p>
                ) : (<p className="text-xs text-gray-500 dark:text-gray-400">
                  Connect your wallet
                </p>)}

              </div>
            </div>

            {/* RIGHT — Connect Wallet Button */}
            <div className="shrink-0">
              <TonConnectButton/>
            </div>
          </div>
        </> /* Booking component can be added here */}
      </div>
    </div>
  )
}
