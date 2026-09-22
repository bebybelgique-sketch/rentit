import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import App from './App'
import './index.css'
import { registerServiceWorker } from './lib/registerServiceWorker'
import { installErrorCapture } from './lib/errorLog'
import { i18nReady } from './i18n-next'

// Ловим то, что мимо React: отклонённые обещания и глобальные ошибки.
// Ставится ДО отрисовки — иначе падение на первом же рендере пройдёт
// мимо журнала.
installErrorCapture()

// Ждём словарь выбранного языка. Для француза промис уже разрешён —
// задержки нет; нидерландцу первый экран приезжает на его языке, а не
// вспышкой французского.
//
// `void` вместо await: верхнеуровневый await превратил бы входной
// модуль в асинхронный и сдвинул порядок загрузки.
void i18nReady.then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  )
})

// Офлайн и установка на телефон. Регистрируется ПОСЛЕ отрисовки и
// только в собранном коде — почему именно так, в шапке файла.
registerServiceWorker()
