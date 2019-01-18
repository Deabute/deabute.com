---
layout: post
title: "In Progress"
author: "Paul Beaudet"
categories: projects
tags: []
image: towards-washington.jpg
---

## Jitploy

The goal of this project is fast continuous delivery. It works by github triggering a pull and restart via web sockets. Currently using it for the push notification server that powers the "Hangout out with me" video chat scheduling service

There is a client and server component of this CD system. The client can be used as a global npm utility all though its currently unfit for general use. It can work together with a "watched" pm2 process

    $ npm install -g pm2 && npm install -g jitploy && pm2 start "yourservice.js" --watch && jitploy --repo "service-repo" --pm2 --token "ask-me"

Right now the client is hard coded to run 5 hours a day. Working on removing this

Source for client can be found at:
<https://github.com/PaulBeaudet/jitployClient>

Services need to be manually registered with the jitploy server. Working on making it less manual and more user friendly. If curious about testing this system (the service, not CI) feel free to reach out

Source for server:
<https://github.com/PaulBeaudet/jitploy>

## Hangout With Me

This is a proof of concept for a video chat scheduling service. The idea is to give an individual a link that they can send people to pick a time to chat with them. The trick is getting scheduling to make sense to people.
This is actually possible with Google hangouts, but there are many reasons it can fail to work.
Most having to do with the various ways calendar gets used and no basis of agreement to use it in a particular way.
The hypothesis here is that a signal purpose application will fair better in creating more opportunities for high fidelity conversations

Right now its a working MVP (minimal viable product) Stuck in the middle of "this could be more usable" and "hey, you should really test it like an MVP should be tested".
Could use some testers

Working on adding it to the contact page of this website, in fact its the main motivator in creating the site to begin with

Source for web app:
<https://github.com/PaulBeaudet/hangoutwithme>

Source for FCM Push notification server:
<https://github.com/PaulBeaudet/pushdetector>

## Github Page
Follow more of my work on Github: <a href="http://github.com/PaulBeaudet" target="_blank">Github page</a>
