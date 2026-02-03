#!/usr/bin/env sh
export NODE_ENV=production
export JWT_SECRET="CxND5dzE2MnlOciSfCovpq717U/XcqPxyR7Ffzuq1CQ="
export NEXTAUTH_SECRET="CxND5dzE2MnlOciSfCovpq717U/XcqPxyR7Ffzuq1CQ="
export NEXTAUTH_URL="https://app.dramnotes.com"
export APP_URL="https://app.dramnotes.com"
export DATABASE_URL="mysql://d85d33_dm_user:U064mL.w~_Qvn@d85d33.myd.infomaniak.com:3306/d85d33_dramnotes_db"
export SMTP_HOST="mail.infomaniak.com"
export SMTP_PORT="587"
export SMTP_SECURE="false"
export SMTP_USER="info@dramnotes.com"
export SMTP_PASSWORD="X**7588-&PLYhppN"
export SMTP_FROM="info@dramnotes.com"

npm install --omit=dev
npm start
