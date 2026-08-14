// src/domain/operator.ts
//
// НЕ КОПИЯ, А РЕЭКСПОРТ. Адрес сайта и личность оператора живут в
// `supabase/functions/_shared/operator.ts`, потому что их одинаково нужно
// знать и юридическим страницам в браузере, и письмам с сервера.
//
// Две копии разошлись бы молча — и расходились: страницы говорили
// `rentit.be`, письма `rentit.app`. Здесь расходиться нечему, файл один.

export {
  SITE_DOMAIN,
  SITE_URL,
  PLATFORM_NAME,
  OPERATOR_NAME,
  OPERATOR_ADDRESS,
  OPERATOR_STATUS,
  CONTACT_EMAIL,
} from '../../supabase/functions/_shared/operator'
