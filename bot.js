try { require('dotenv').config() } catch (_) {}
const { Telegraf, Markup, session } = require('telegraf')
const path = require('path')
const fs   = require('fs')

// ─── КОНФИГУРАЦИЯ ────────────────────────────────────────────────────
// Данные вшиты напрямую — .env файл не нужен
const BOT_TOKEN  = process.env.BOT_TOKEN  || '8728208108:AAHtJiyvIS3JiNHOcuY_WpXwtm7hH9MD-k0'
const ADMIN_ID   = process.env.ADMIN_CHAT_ID || '5746653367'
const AUDIO_FILE = path.join(__dirname, 'audio', '7_radicals.m4a')
const TG_LINK    = '@mirovozzrenierosta'

const bot = new Telegraf(BOT_TOKEN)
bot.use(session())

// ─── СОСТОЯНИЯ ВОРОНКИ ───────────────────────────────────────────────
const S    = { START:'start', AUDIO:'audio', Q1:'q1', Q2:'q2', Q3:'q3', DONE:'done' }
const init = () => ({ state: S.START, answers: {}, name: '' })

// ─── ВОПРОСЫ И ВАРИАНТЫ ──────────────────────────────────────────────
const Q1 = [
  { t: '🔒 Знаю что делать — но не делаю',      d: 'q1_block' },
  { t: '💰 Деньги не растут, хотя стараюсь',    d: 'q1_money' },
  { t: '🧭 Нет понимания себя и своего пути',    d: 'q1_self'  },
  { t: '🤝 Проблемы в отношениях / команде',     d: 'q1_rel'   },
]
const Q2 = [
  { t: '🌱 Только начинаю',                          d: 'q2_new'   },
  { t: '📖 1–3 года, есть база',                     d: 'q2_mid'   },
  { t: '🚀 3+ лет, ищу новый уровень',               d: 'q2_adv'   },
  { t: '😔 Давно, но результаты разочаровывают',      d: 'q2_stuck' },
]
const Q3 = [
  { t: '🔍 Понять себя и свою природу',     d: 'q3_self'  },
  { t: '💵 Снять финансовый потолок',       d: 'q3_money' },
  { t: '💞 Улучшить отношения',             d: 'q3_rel'   },
  { t: '✨ Комплексный рост — всё сразу',   d: 'q3_all'   },
]

const LABELS = {
  q1_block: 'Знаю что делать — но не делаю',
  q1_money: 'Деньги не растут',
  q1_self:  'Нет понимания себя',
  q1_rel:   'Проблемы в отношениях',
  q2_new:   'Только начинаю',
  q2_mid:   '1–3 года практики',
  q2_adv:   '3+ лет, ищу новый уровень',
  q2_stuck: 'Давно, без результата',
  q3_self:  'Понять себя',
  q3_money: 'Снять финансовый потолок',
  q3_rel:   'Улучшить отношения',
  q3_all:   'Комплексный рост',
}

// ─── ПЕРСОНАЛЬНЫЙ АНАЛИЗ ─────────────────────────────────────────────
function buildAnalysis(q1, q3) {
  const pain = {
    q1_block: 'Ты знаешь что делать — но не делаешь. Это не слабость воли: это конфликт между пониманием и нейрофизиологией. Инструменты есть — операционная система их не запускает.',
    q1_money: 'Финансовый потолок — это почти никогда не про навыки. Это про скрытые «контракты» с деньгами, которые ты получил ещё в детстве.',
    q1_self:  'Нет понимания себя — нет базы для любых решений. Любой инструмент будет работать вполсилы: ты строишь на песке.',
    q1_rel:   'Отношения — это зеркало внутренних паттернов. Пока паттерн не виден, ситуация повторяется снова и снова.',
  }
  const goal = {
    q3_self:  'Именно с этого начинается программа: точная диагностика твоей конфигурации — тип, радикал, уровень сознания.',
    q3_money: 'Финансовая психология — центральный блок: 7 деструктивных контрактов с деньгами и полная переустановка мышления.',
    q3_rel:   'Блок отношений раскрывает стили привязанности, созависимость и метод работы с конфликтом через третью позицию.',
    q3_all:   'Программа построена как комплексная трансформация в одной логике: личность → деньги → отношения.',
  }
  return `${pain[q1] || ''}\n\n${goal[q3] || ''}`
}

// ─── УТИЛИТЫ ─────────────────────────────────────────────────────────
const kbd    = opts => Markup.inlineKeyboard(opts.map(o => [Markup.button.callback(o.t, o.d)]))
const delay  = ms   => new Promise(r => setTimeout(r, ms))
const rmKbd  = ctx  => { try { ctx.editMessageReplyMarkup({ inline_keyboard: [] }) } catch (_) {} }

async function notifyAdmin(ctx) {
  if (!ADMIN_ID) return
  const { first_name, last_name, username, id } = ctx.from
  const { q1, q2, q3 } = ctx.session.answers
  const msg = [
    '🔔 *Новый лид из бота!*', '',
    `👤 ${first_name}${last_name ? ' ' + last_name : ''}`,
    `📱 ${username ? '@' + username : 'ID: ' + id}`, '',
    `*Что мешает:*  ${LABELS[q1] || '—'}`,
    `*Опыт:*        ${LABELS[q2] || '—'}`,
    `*Цель:*        ${LABELS[q3] || '—'}`,
  ].join('\n')
  try { await bot.telegram.sendMessage(ADMIN_ID, msg, { parse_mode: 'Markdown' }) }
  catch (e) { console.error('Ошибка уведомления:', e.message) }
}

// ─── /start ──────────────────────────────────────────────────────────
bot.start(async ctx => {
  ctx.session      = init()
  ctx.session.name = ctx.from.first_name || 'друг'

  await ctx.replyWithMarkdown(
    `Привет, *${ctx.session.name}*! 👋\n\n` +
    `Это бот программы *«Понять себя — изменить всё»* — авторской методологии Александра Иванищева.\n\n` +
    `Начнём с бесплатной аудиолекции:\n` +
    `🎧 *«7 радикалов и биология нашего характера»*\n\n` +
    `30 минут — и ты поймёшь, как устроена твоя нейрофизиологическая природа.`,
    Markup.inlineKeyboard([[Markup.button.callback('🎧 Получить аудио бесплатно', 'get_audio')]])
  )
})

// ─── ВЫДАЧА АУДИО ────────────────────────────────────────────────────
bot.action('get_audio', async ctx => {
  await ctx.answerCbQuery('Отправляю...')
  await rmKbd(ctx)
  ctx.session       = ctx.session || init()
  ctx.session.state = S.AUDIO

  if (fs.existsSync(AUDIO_FILE)) {
    await ctx.replyWithAudio(
      { source: AUDIO_FILE },
      { caption: `«7 радикалов и биология нашего характера»\nАвтор: Александр Иванищев · ${TG_LINK}` }
    )
  } else {
    // Fallback: файл ещё не загружен
    await ctx.replyWithMarkdown(
      `🎧 *«7 радикалов и биология нашего характера»*\n\n` +
      `Александр пришлёт аудио напрямую:\n👉 ${TG_LINK}`
    )
  }

  await delay(3000)
  await sendQ1(ctx)
})

// ─── ВОПРОС 1 ────────────────────────────────────────────────────────
async function sendQ1(ctx) {
  ctx.session.state = S.Q1
  await ctx.replyWithMarkdown(
    'Пока слушаешь — задам 3 коротких вопроса (30 секунд).\n' +
    'Это поможет подобрать точную рекомендацию.\n\n' +
    '❓ *Что сейчас мешает тебе больше всего?*',
    kbd(Q1)
  )
}

Q1.forEach(({ d }) => {
  bot.action(d, async ctx => {
    if (ctx.session?.state !== S.Q1) return ctx.answerCbQuery()
    await ctx.answerCbQuery('✓')
    await rmKbd(ctx)
    ctx.session.answers.q1 = d
    ctx.session.state      = S.Q2
    await ctx.reply(`✓ ${LABELS[d]}`)
    await delay(700)
    await sendQ2(ctx)
  })
})

// ─── ВОПРОС 2 ────────────────────────────────────────────────────────
async function sendQ2(ctx) {
  ctx.session.state = S.Q2
  await ctx.replyWithMarkdown('❓ *Как давно занимаешься саморазвитием?*', kbd(Q2))
}

Q2.forEach(({ d }) => {
  bot.action(d, async ctx => {
    if (ctx.session?.state !== S.Q2) return ctx.answerCbQuery()
    await ctx.answerCbQuery('✓')
    await rmKbd(ctx)
    ctx.session.answers.q2 = d
    ctx.session.state      = S.Q3
    await ctx.reply(`✓ ${LABELS[d]}`)
    await delay(700)
    await sendQ3(ctx)
  })
})

// ─── ВОПРОС 3 ────────────────────────────────────────────────────────
async function sendQ3(ctx) {
  ctx.session.state = S.Q3
  await ctx.replyWithMarkdown('❓ *Что важнее всего изменить за ближайшие 3 месяца?*', kbd(Q3))
}

Q3.forEach(({ d }) => {
  bot.action(d, async ctx => {
    if (ctx.session?.state !== S.Q3) return ctx.answerCbQuery()
    await ctx.answerCbQuery('✓')
    await rmKbd(ctx)
    ctx.session.answers.q3 = d
    ctx.session.state      = S.DONE
    await ctx.reply(`✓ ${LABELS[d]}`)
    await delay(1200)
    await sendOffer(ctx)
  })
})

// ─── ОФФЕР ───────────────────────────────────────────────────────────
async function sendOffer(ctx) {
  const { q1, q3 } = ctx.session.answers
  const name       = ctx.session.name || 'друг'

  await ctx.replyWithMarkdown(
    `*${name}, вот твоя точка старта:*\n\n` +
    `${buildAnalysis(q1, q3)}\n\n` +
    `━━━━━━━━━━━━━━━\n` +
    `Программа *«Понять себя — изменить всё»* создана именно для этого:\n\n` +
    `🔹 *Пилот* — 4 900 ₽ · 3–5 встреч в группе · старт скоро\n` +
    `🔹 *Полный курс* — 9 900 ₽ · все 7 модулей + 19 воркбуков\n` +
    `🔹 *Курс + группа* — 16 900 ₽ · с живыми разборами\n\n` +
    `Что выбираешь?`,
    Markup.inlineKeyboard([
      [Markup.button.callback('🚀 Хочу в пилотную группу',       'offer_pilot')],
      [Markup.button.callback('📚 Расскажи про полный курс',      'offer_course')],
      [Markup.button.callback('💬 Написать Александру напрямую', 'offer_direct')],
    ])
  )

  await notifyAdmin(ctx)
}

// ─── РЕАКЦИИ НА ОФФЕР ────────────────────────────────────────────────
bot.action('offer_pilot', async ctx => {
  await ctx.answerCbQuery('Отлично!')
  await rmKbd(ctx)
  await ctx.replyWithMarkdown(
    '🚀 *Пилотная группа*\n\n' +
    '3–5 онлайн-встреч · группа 10–15 человек\n' +
    'Разбираем модули 0–2: диагностика, конструкция личности, мировоззрение\n\n' +
    'Цена: *4 900 ₽*\n\n' +
    `Напиши Александру — он расскажет о ближайших датах:\n👉 ${TG_LINK}`
  )
})

bot.action('offer_course', async ctx => {
  await ctx.answerCbQuery()
  await rmKbd(ctx)
  await ctx.replyWithMarkdown(
    '📚 *Полный курс «Понять себя — изменить всё»*\n\n' +
    '✓ Все 7 модулей от диагностики до OKR-плана на 90 дней\n' +
    '✓ 19 профессиональных воркбуков\n' +
    '✓ 6 авторских аудиолекций\n' +
    '✓ Генограмма + трансгенерационные паттерны\n' +
    '✓ 6 практик саморегуляции\n' +
    '✓ PDF + аудио остаются у тебя навсегда\n\n' +
    'Цена: *9 900 ₽* (рынок — 13 737 ₽ в среднем)\n\n' +
    `Записаться → ${TG_LINK}`
  )
})

bot.action('offer_direct', async ctx => {
  await ctx.answerCbQuery()
  await rmKbd(ctx)
  await ctx.replyWithMarkdown(
    `Напиши Александру — он ответит лично и поможет выбрать формат:\n\n👉 ${TG_LINK}\n\n_Обычно отвечает в течение нескольких часов._`
  )
})

// ─── СЛУЖЕБНЫЕ КОМАНДЫ ───────────────────────────────────────────────
bot.command('restart', async ctx => {
  ctx.session = init()
  await ctx.reply('Сбросил. Начни заново: /start')
})

bot.help(async ctx => {
  await ctx.replyWithMarkdown(
    '*Команды:*\n/start — начать\n/restart — начать заново\n\n' +
    `По вопросам → ${TG_LINK}`
  )
})

// ─── ЗАПУСК ──────────────────────────────────────────────────────────
bot.launch().then(() => {
  console.log('✅ Бот запущен! Polling активен.')
  console.log(`📢 Уведомления: ${ADMIN_ID ? 'включены → ' + ADMIN_ID : 'отключены (ADMIN_CHAT_ID не задан)'}`)
  console.log(`🎧 Аудиофайл: ${fs.existsSync(AUDIO_FILE) ? '✓ найден' : '⚠ не найден — будет fallback-текст'}`)
})

process.once('SIGINT',  () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
