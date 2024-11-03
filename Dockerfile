FROM node:18.17.1-alpine3.17 AS base
# node-gyp dependencies
RUN apk add --update python3 make g++ && rm -rf /var/cache/apk/*

FROM base AS build
ARG APP
WORKDIR /app
# I'm choosing to build outside docker because I need the build hash to
# to make sure pushing to artifact registry doesn't make duplicate images.
# this is just to save cost
COPY ./package.json ./yarn.lock ./

# install only prod
RUN yarn install --prod

COPY . .

RUN yarn web:build

# use node prune to remove unused dependencies
RUN wget https://gobinaries.com/tj/node-prune --output-document - | /bin/sh && node-prune

FROM alpine:3.18.3 AS production
ARG APP
WORKDIR /app
COPY --from=build /app/dist ./dist
RUN apk add nodejs npm --no-cache

RUN npm install -g serve

EXPOSE 3000

CMD ["serve", "dist", "--single"]