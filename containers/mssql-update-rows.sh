#!/bin/bash

MSSQLUSER=sa
MSSQLPASS=testPassword123
MSSQLADDRESS=localhost,1433

update_rows() {
  sqlcmd -S $MSSQLADDRESS -U $MSSQLUSER -P $MSSQLPASS  \
    -Q "UPDATE [dbo].[Album] SET Title = CONCAT(NewID(), GETUTCDATE()) WHERE 1=1;"
}
