---
layout: post
title: "Obstructive Unit Testing"
author: "Paul Beaudet"
categories: projects
tags: []
image: jitploy_cover_photo.jpg
---

This rant outlines issues with integration pipelines.

### Critical Questions

Why is your company spending so much effort outside of its core business logic?

Sure, your testing pipeline test your company's core business logic, but is the pipeline itself core to your company?

### The friction with pipelines

Engineering is apt to integrate automated testing in line, synchronously with production release methodology to prevent regression.

This creates a bottle neck in critical triage situations. Often times rollback is possible, but hot fixes are too complex to consider attempting or might be difficult and or error prone to pull back into version control.

Have no idea what the config for prod is?

To further outline issues with the pipeline Configuration is normally divorced from a service's version control. Typically this is because of configuration sensitivity and different mutations of environmental targets. As a result configuration and environment are managed with centralized orchestration tools geared towards assisting traditionally operations only oriented employees. Who likely only coordinated manual and semi-automatic release task because they were only ever a step in that cycle. An important note about how these tools work is that they typically put all configuration in one basket which is to say in plain text in a private versioned repository. Which defeats the idea of keeping sensitive information out of version control. It is more of a solution to propagating multiple environments than hiding sensitive info. Sometimes sensitive bits are encrypted with a public key that the central build server has the private key to. Normally entails an extra encrypt step per variable in development. A step that consequently hides sensitive information from people the organization should trust.

Building to be interpreted

Services built with interpreted languages should be able to forgo build servers to speed up development and deployment operations. Managing shared build configuration tools, building integration, and building deployment systems are tangential to likely desired core competencies of most hired developers.

### Think about deployment separately

Normally thinking about deployment separately is called, continuous delivery. Using the term delivery in the context that the product is ready to go hot off the automated pipeline and the product team just says when to release. This is in the context of a pipeline with a synchronous test integration step. In which case delivery is a manual step. They are separate concerns and the pipelines should completely automatic for both. Thus eliminating the need for packaging, and giving the ability to hot fix in triage situations keeping track of the changes. The promise is when they are separated you can get the best of both worlds. Test when desired, deploy when needed. Even do it in parallel when developing. Manual regression test in a dev env might show issues before the unit test get a chance to complete. There are many reason test and deployments should stand and run on their own.

### Enter Immediate Versioned Deployment

This is the process in which branches of your source control are tied to running environments. Prod, Dev, Integration, what ever the environment might be its as simple as Git revert and push to rollback, git commit and push to feature toggle. Its safe to have an easier more familiar way to manage when things go wrong. With configuration encrypted in source all of this is possible. Config changes and release actions are tracked in source just as code change are. This gives a traceable history of problem resolution. This is Jitploy's current capability it also looks to handle infrastructure management in much the same way.
