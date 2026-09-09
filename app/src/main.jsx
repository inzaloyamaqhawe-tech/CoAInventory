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
      <SessionProvider>
        <StoreProvider>
          <BranchFilterProvider>
            <App />
          </BranchFilterProvider>
        </StoreProvider>
      </SessionProvider>
    </HashRouter>
  </React.StrictMode>
)
