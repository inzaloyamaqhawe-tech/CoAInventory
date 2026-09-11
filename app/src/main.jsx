import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { StoreProvider } from './state/store.jsx'
import { SessionProvider } from './state/session.jsx'
import { BranchFilterProvider } from './state/branchFilter.jsx'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      {/* Store outermost: the signed-in person is now resolved against the
          live roster in store state, so Session has to sit inside it. */}
      <StoreProvider>
        <SessionProvider>
          <BranchFilterProvider>
            <App />
          </BranchFilterProvider>
        </SessionProvider>
      </StoreProvider>
    </HashRouter>
  </React.StrictMode>
)
