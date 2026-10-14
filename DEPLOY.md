# Запуск на своём сервере (Docker)

Всё приложение — сайт, API, живые обновления, MongoDB и Redis — поднимается
одной командой и отвечает на **порту 3000**. HTTPS и домен
(`mind.capantcloud.eu`) даёт прокси перед ним.

```
браузер ──HTTPS──> прокси (mind.capantcloud.eu) ──> :3000 web (nginx)
                                                     ├── сам сайт
                                                     ├── /api/*       ──> backend :4000
                                                     └── /socket.io/* ──> backend :4000
                                                                           ├── mongo
                                                                           └── redis
```

Сайт и API на одном адресе — поэтому вход работает и в Safari (iPhone/Mac).

## 1. Зайти на сервер

```bash
ssh viktor@178.104.38.204
```

Сразу смените пароль (он был отправлен в переписке): `passwd`.
Лучше перейти на вход по SSH-ключу.

Проверьте Docker:

```bash
docker --version && docker compose version
docker ps
```

Если `docker ps` пишет *permission denied* — попросите администратора добавить
вас в группу docker (`sudo usermod -aG docker viktor`), затем выйдите и зайдите снова.

## 2. Скачать проект в /srv

```bash
cd /srv
git clone https://github.com/Vik94inGit/mind-constructor.git
cd mind-constructor
```

Репозиторий приватный? Тогда git попросит логин и пароль — вместо пароля
вставьте GitHub Personal Access Token (GitHub → Settings → Developer settings →
Personal access tokens, право *Contents: Read*).

## 3. Настройки

```bash
cp .env.example .env
openssl rand -hex 32     # скопируйте результат
nano .env
```

В `.env`:

- `PUBLIC_URL=https://mind.capantcloud.eu`
- `SESSION_SECRET=` — строка из `openssl rand -hex 32`
- `GOOGLE_CLIENT_ID=` — если нужен вход через Google (тогда в Google Cloud
  Console добавьте `https://mind.capantcloud.eu` в *Authorized JavaScript origins*)
- `MONGO_URI=` — оставьте пустым, чтобы база была здесь же, на сервере. Или
  вставьте адрес нынешней базы (MongoDB Atlas, как на Render), чтобы
  пользоваться теми же картами.

Сохранить в nano: `Ctrl+O`, `Enter`, выйти: `Ctrl+X`.

## 4. Запуск

```bash
docker compose up -d --build
```

Первый раз — несколько минут. Проверка:

```bash
docker compose ps                     # все четыре: running
docker compose logs backend | tail    # «DB Connected», «Server on port 4000»
curl -I http://localhost:3000         # HTTP/1.1 200 OK
```

Откройте https://mind.capantcloud.eu, зарегистрируйтесь — готово.
Оттуда же приложение ставится на телефон и компьютер.

## Что сказать администратору прокси

- `mind.capantcloud.eu` → порт `3000` этого сервера.
- Прокси должен пропускать **WebSocket** (заголовки `Upgrade` и `Connection`) —
  на них живые обновления карты.
- Передавать `X-Forwarded-Proto: https`.
- Если прокси на этом же сервере, порт можно закрыть снаружи: в `.env`
  `WEB_PORT=127.0.0.1:3000`.

## Обновить до новой версии

```bash
cd /srv/mind-constructor
git pull
docker compose up -d --build
```

Данные (карты, пользователи) лежат в томах Docker и при обновлении не теряются.

## Полезное

```bash
docker compose logs -f backend          # логи сервера
docker compose restart backend          # перезапуск
docker compose down                     # остановить (данные остаются)
docker compose exec -T mongo mongodump --archive --gzip > backup-$(date +%F).gz   # резервная копия базы
docker compose exec -T mongo mongorestore --archive --gzip < backup-ДАТА.gz       # восстановление
```

Перенести карты из старой базы (Atlas) в базу на сервере:

```bash
docker compose exec -T mongo mongodump --uri "СТАРЫЙ_MONGO_URI" --archive --gzip > atlas.gz
docker compose exec -T mongo mongorestore --archive --gzip --drop < atlas.gz
```
