"use strict";
module.exports = {
    up: function(migration) {
        return migration.addConstraint('groupMemberships', ['accountId', 'groupId'], {
          type: 'unique',
          name: 'groupMemberships_accountId_groupId_uk'
        });
    }
};