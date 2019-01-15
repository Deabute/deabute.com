#!/bin/bash
git add .
git commit -m "$1"
export JEKELL_ENV="production"
jekyll build
aws s3 cp _site/ s3://deabute.com --recursive
git push
