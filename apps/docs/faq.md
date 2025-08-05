---
title: "FAQ"
description: "Frequently Asked Questions"
---

<Accordion title="How much does an end to end Open SWE run cost?">
  The cost per run varies greatly based on the complexity of the task, the size of the repository, and the number of files that need to be changed.

  For most tasks, you can expect to pay between $0.50 -> $3.00 when using Claude Sonnet 4.
  For the same tasks running on Claude Opus 4, you can expect to pay between $1.50 - $6.00.

  Always remember to monitor your runs if you're cost conscious. The most expensive run I've seen Open SWE complete was ~50M Opus 4 tokens, costing $25.00.
</Accordion>

<Accordion title="Does Open SWE automatically cache tokens?">
  Yes. When using Anthropic models, all input tokens are cached on Anthropic's servers.
</Accordion>

<Accordion title="My run failed midway through. What now?">
  We're sorry you're experiencing this! Open SWE will automatically commit any changes it makes to a draft pull request. Please check the draft pull request and make any necessary changes.

  If a run fails, you will need to start over.
</Accordion>

<Accordion title="Can I use Open SWE in a production environment?">
  Yes! We've been using Open SWE internally at LangChain for a while now, and it's been giving us great results.

  We recommend forking and deploying Open SWE yourself if you plan on using it in a production environment. For checking out the product, the [demo application](https://swe.langchain.com) will work fine.
</Accordion>

<Accordion title="I installed Open SWE on a repository in my organization, but it doesn't show up in the UI. Why?">
  Some GitHub organizations require administrator approval to install GitHub apps. Please reach out to an administrator in your organization to approve the installation request.  
</Accordion>

<Accordion title="What sandbox environment is Open SWE running in?">
  Open SWE's sandbox environment is powered by [Daytona.io](https://daytona.io).
</Accordion>

<Accordion title="Can I contribute to Open SWE?">
  Yes! We're always looking for contributors to help us improve Open SWE. Feel free to pick up an [open issue](https://github.com/langchain-ai/open-swe/issues) or submit a pull request with a new feature or bug fix.
</Accordion>
