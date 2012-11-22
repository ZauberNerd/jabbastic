jabbastic
=========

Jabbastic (made up from jabber and bombastic) is a tool which checks a given website every X minutes if condition Y is satisfied. If so, it notifies it's subscribers via jabber.


#Configuration
You need to put a config.json file inside the main directory with the following content:

```JSON
{
    "jabber": {
        "jid": "xyz@gmail.com",
        "password": "xxx",
        "host": "talk.google.com",
        "port": 5222
    }
}
```

Be aware that this is in it's early stages and might not work as expected.
If you find any bugs, please either file an issue or fix them and send me a pull request ;)