FROM ghcr.io/puppeteer/puppeteer:latest
USER root
RUN apt install -y sudo iproute2 \
  && echo 'pptruser ALL=(ALL) NOPASSWD: /sbin/ip' >/etc/sudoers.d/pptruser-ip
USER pptruser
COPY --chown=pptruser:pptruser . .
RUN npm install
CMD ["npm", "test"]
